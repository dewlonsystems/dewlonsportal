import logging
import json
import hmac  # ✅ ADDED
import hashlib  # ✅ ADDED
from decimal import Decimal
from uuid import uuid4
from django.conf import settings
from django.http import HttpResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import Transaction
from .utils import (
    send_stk_push,
    initialize_paystack_transaction,
    normalize_phone_number,
    verify_paystack_transaction,
    query_daraja_transaction_status  # ✅ ADDED
)
from django.db.models import Sum
from datetime import datetime, timedelta
from collections import OrderedDict

logger = logging.getLogger(__name__)


class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        start_date_str = request.query_params.get('start')
        end_date_str = request.query_params.get('end')

        if start_date_str and end_date_str:
            try:
                start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00')).date()
                end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00')).date()
                if start_date > end_date:
                    return Response({'error': 'Start date must be before end date'}, status=400)
            except ValueError:
                return Response({'error': 'Invalid date format. Use ISO 8601 (e.g., 2026-02-01)'}, status=400)
        else:
            end_date = timezone.now().date()
            start_date = end_date - timedelta(days=29)

        if user.is_superuser:
            queryset = Transaction.objects.filter(
                status='COMPLETED',
                created_at__date__range=[start_date, end_date]
            )
        else:
            queryset = Transaction.objects.filter(
                initiated_by=user,
                status='COMPLETED',
                created_at__date__range=[start_date, end_date]
            )

        total = queryset.aggregate(total=Sum('amount'))['total'] or 0

        daily_data = (
            queryset
            .extra(select={'date': "DATE(created_at)"})
            .values('date')
            .annotate(amount=Sum('amount'))
            .order_by('date')
        )

        date_cursor = start_date
        trend = OrderedDict()
        while date_cursor <= end_date:
            trend[date_cursor.isoformat()] = "0.00"
            date_cursor += timedelta(days=1)

        for entry in daily_data:
            date_key = entry['date'].isoformat()
            if date_key in trend:
                trend[date_key] = str(entry['amount'])

        return Response({
            'total_collected': str(total),
            'period_start': start_date.isoformat(),
            'period_end': end_date.isoformat(),
            'trend': list(trend.items())
        })


class TransactionListView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        if user.is_superuser:
            transactions = Transaction.objects.all().order_by('-created_at')
        else:
            transactions = Transaction.objects.filter(initiated_by=user).order_by('-created_at')
        
        data = []
        for t in transactions:
            data.append({
                'id': t.id,
                'amount': str(t.amount),
                'payment_method': t.get_payment_method_display(),
                'status': t.get_status_display(),
                'initiated_by': t.initiated_by.first_name or t.initiated_by.username,
                'created_at': t.created_at.isoformat(),
                'customer_identifier': t.customer_identifier,
                'mpesa_checkout_request_id': t.mpesa_checkout_request_id,
                'paystack_reference': t.paystack_reference,
            })
        return Response(data)


class TransactionDetailView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, pk):
        try:
            transaction = Transaction.objects.get(pk=pk)
        except Transaction.DoesNotExist:
            return Response({'error': 'Transaction not found'}, status=status.HTTP_404_NOT_FOUND)

        if not request.user.is_superuser and transaction.initiated_by != request.user:
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        return Response({
            'id': transaction.id,
            'amount': str(transaction.amount),
            'payment_method': transaction.payment_method,
            'status': transaction.status,
            'initiated_by': transaction.initiated_by.first_name or transaction.initiated_by.username,
            'created_at': transaction.created_at.isoformat(),
            'updated_at': transaction.updated_at.isoformat(),
            'customer_identifier': transaction.customer_identifier,
            'mpesa_checkout_request_id': transaction.mpesa_checkout_request_id,
            'paystack_reference': transaction.paystack_reference,
            'response_data': transaction.response_data,
        })


class InitiatePaymentView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        user = request.user
        payment_method = request.data.get('payment_method')
        amount = request.data.get('amount')
        customer_identifier = request.data.get('customer_identifier')

        if not payment_method or not amount or not customer_identifier:
            return Response(
                {'error': 'payment_method, amount, and customer_identifier are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            amount = Decimal(str(amount))
            if amount <= 0:
                raise ValueError("Amount must be positive")
        except (ValueError, TypeError):
            return Response({'error': 'Invalid amount'}, status=status.HTTP_400_BAD_REQUEST)

        if payment_method not in ['STK_PUSH', 'PAYSTACK']:
            return Response({'error': 'Invalid payment_method'}, status=status.HTTP_400_BAD_REQUEST)

        transaction = Transaction.objects.create(
            initiated_by=user,
            amount=amount,
            payment_method=payment_method,
            status='PENDING',
            customer_identifier=customer_identifier
        )

        response_data = {
            'id': transaction.id,
            'amount': str(transaction.amount),
            'status': 'PENDING',
            'message': 'Payment initiated'
        }

        try:
            if payment_method == 'STK_PUSH':
                phone = normalize_phone_number(customer_identifier)
                result = send_stk_push(phone, float(amount), transaction.id)
                if result.get('success'):
                    transaction.mpesa_checkout_request_id = result.get('CheckoutRequestID')
                    transaction.response_data = result
                    transaction.save()
                    response_data['checkout_request_id'] = result.get('CheckoutRequestID')
                    response_data['customer_message'] = result.get('CustomerMessage')
                else:
                    transaction.status = 'FAILED'
                    transaction.response_data = result
                    transaction.save()
                    return Response(
                        {'error': 'Failed to initiate STK Push', 'details': result.get('error')},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )

            elif payment_method == 'PAYSTACK':
                email = customer_identifier.strip()
                if '@' not in email:
                    transaction.delete()
                    return Response(
                        {'error': 'Invalid email address for Paystack'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                reference = str(uuid4())
                paystack_result = initialize_paystack_transaction(
                    email=email,
                    amount=amount,
                    reference=reference
                )
                if paystack_result.get('success'):
                    transaction.paystack_reference = reference
                    transaction.response_data = paystack_result
                    transaction.save()
                    response_data['paystack_reference'] = reference
                    response_data['checkout_url'] = paystack_result['authorization_url']
                else:
                    transaction.status = 'FAILED'
                    transaction.response_data = paystack_result
                    transaction.save()
                    return Response(
                        {'error': 'Failed to initialize Paystack', 'details': paystack_result.get('error')},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )

            return Response(response_data, status=status.HTTP_201_CREATED)

        except ValueError as ve:
            transaction.delete()
            return Response(
                {'error': 'Validation error', 'details': str(ve)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            transaction.delete()
            logger.error(f"Unexpected error during payment initiation: {e}")
            return Response(
                {'error': 'Internal server error'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class VerifyPaystackTransactionView(APIView):
    """
    Manual verification endpoint - calls Paystack API to check transaction status
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, reference):
        try:
            transaction = Transaction.objects.get(paystack_reference=reference)
        except Transaction.DoesNotExist:
            return Response({'error': 'Transaction not found'}, status=404)

        if not request.user.is_superuser and transaction.initiated_by != request.user:
            return Response({'error': 'Permission denied'}, status=403)

        # Call Paystack API to verify
        verification_result = verify_paystack_transaction(reference)
        
        if verification_result.get('success'):
            paystack_data = verification_result['data'].get('data', {})
            status_val = paystack_data.get('status')
            amount_paid = Decimal(paystack_data.get('amount', 0)) / 100
            
            # Update transaction
            transaction.status = 'COMPLETED' if status_val == 'success' else 'FAILED'
            transaction.response_data = verification_result['data']
            transaction.save()
            
            return Response({
                'id': transaction.id,
                'status': transaction.status,
                'amount': str(transaction.amount),
                'amount_paid': str(amount_paid),
                'paystack_status': status_val,
                'verified': True
            })
        else:
            return Response({
                'error': 'Failed to verify with Paystack',
                'details': verification_result.get('error')
            }, status=400)


class QueryMpesaTransactionStatusView(APIView):
    """
    Manual query endpoint for M-Pesa transaction status
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        checkout_request_id = request.data.get('checkout_request_id')
        
        if not checkout_request_id:
            return Response(
                {'error': 'checkout_request_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            transaction = Transaction.objects.get(mpesa_checkout_request_id=checkout_request_id)
        except Transaction.DoesNotExist:
            return Response({'error': 'Transaction not found'}, status=404)

        if not request.user.is_superuser and transaction.initiated_by != request.user:
            return Response({'error': 'Permission denied'}, status=403)

        # Query Daraja for transaction status
        query_result = query_daraja_transaction_status(checkout_request_id)
        
        if query_result.get('success'):
            result_data = query_result['data']
            result_code = result_data.get('ResultCode')
            
            # Update transaction based on result
            if result_code is None:
                transaction.status = 'PENDING'
            elif result_code == 1032:
                transaction.status = 'CANCELLED'
            elif result_code == 0:
                transaction.status = 'COMPLETED'
            elif result_code == 1037:
                transaction.status = 'TIMEOUT'
            else:
                transaction.status = 'FAILED'
        else:
            transaction.status = 'PENDING'
            
            transaction.response_data = result_data
            transaction.save()
            
            return Response({
                'id': transaction.id,
                'status': transaction.status,
                'result_code': result_code,
                'result_desc': result_data.get('ResultDesc'),
                'queried': True
            })


# ========================
# WEBHOOK VIEWS (FUNCTION-BASED, CSRF-EXEMPT)
# ========================

@csrf_exempt
def daraja_webhook(request):
    """
    Handle M-Pesa STK Push callback from Safaricom.
    Must return plain-text 'OK' with HTTP 200.
    """
    if request.method == 'GET':
        logger.info("Daraja webhook health check (GET)")
        return HttpResponse("OK", status=200)
    if request.method != 'POST':
        logger.warning(f"Daraja webhook received {request.method} method")
        return HttpResponse("Method not allowed", status=405)
    
    logger.info("Received Daraja webhook")
    
    try:
        payload = json.loads(request.body)
        logger.debug(f"Daraja webhook payload: {payload}")
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        logger.warning(f"Invalid JSON in Daraja webhook: {e}")
        return HttpResponse("OK", status=200)  # ✅ Always return 200

    body = payload.get('Body', {})
    stk_callback = body.get('stkCallback', {})
    checkout_request_id = stk_callback.get('CheckoutRequestID')
    result_code = stk_callback.get('ResultCode')
    result_desc = stk_callback.get('ResultDesc', '')

    if not checkout_request_id:
        logger.warning("Missing CheckoutRequestID in Daraja webhook")
        return HttpResponse("OK", status=200)  # ✅ Always return 200

    try:
        transaction = Transaction.objects.get(mpesa_checkout_request_id=checkout_request_id)
    except Transaction.DoesNotExist:
        logger.warning(f"Transaction not found for CheckoutRequestID: {checkout_request_id}")
        return HttpResponse("OK", status=200)  # ✅ Always return 200

    # Map result codes to statuses (more detailed than before)
    if result_code == 0:
        transaction.status = 'COMPLETED'
    elif result_code == 1032:
        transaction.status = 'CANCELLED'
    elif result_code == 1037:
        transaction.status = 'TIMEOUT'
    else:
        transaction.status = 'FAILED'

    # ✅ Save full callback payload for debugging/auditing
    transaction.response_data = payload
    transaction.save()
    
    logger.info(f"Daraja webhook processed: {transaction.id} -> {transaction.status} (Code: {result_code})")
    
    # ✅ Generate receipt if payment is successful (optional - uncomment if you have receipt system)
    # if transaction.status == 'COMPLETED':
    #     try:
    #         from receipts.models import Receipt
    #         if not Receipt.objects.filter(transaction=transaction).exists():
    #             from receipts.services import ReceiptGenerator
    #             ReceiptGenerator.generate_receipt(transaction)
    #     except Exception as e:
    #         logger.error(f"Failed to generate receipt: {e}")
    
    return HttpResponse("OK", status=200)  # ✅ Always return 200


@csrf_exempt
def paystack_webhook(request):
    """
    Handle Paystack webhook events.
    Must always return HTTP 200 to acknowledge receipt.
    """
    if request.method == 'GET':
        logger.info("Paystack webhook health check (GET)")
        return HttpResponse(status=200)
    if request.method != 'POST':
        logger.warning(f"Paystack webhook received {request.method} method")
        return HttpResponse(status=405)
    
    logger.info("Received Paystack webhook")
    
    # ✅ Use PAYSTACK_WEBHOOK_SECRET, not PAYSTACK_SECRET_KEY
    secret = getattr(settings, 'PAYSTACK_WEBHOOK_SECRET', None)
    if not secret:
        logger.error("PAYSTACK_WEBHOOK_SECRET not set in settings")
        return HttpResponse(status=200)  # ✅ Always return 200

    signature = request.headers.get('x-paystack-signature')
    if not signature:
        logger.warning("Missing Paystack signature")
        return HttpResponse(status=200)  # ✅ Always return 200

    # ✅ Verify signature using hmac and hashlib (now imported)
    computed_signature = hmac.new(
        secret.encode('utf-8'),
        request.body,
        hashlib.sha512
    ).hexdigest()

    if not hmac.compare_digest(signature, computed_signature):
        logger.warning("Invalid Paystack signature - possible tampering")
        return HttpResponse(status=200)  # ✅ Always return 200

    try:
        event = json.loads(request.body)
        logger.debug(f"Paystack webhook event: {event}")
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        logger.warning(f"Invalid JSON in Paystack webhook: {e}")
        return HttpResponse(status=200)  # ✅ Always return 200

    event_type = event.get('event')
    
    # ✅ Handle both charge.success AND charge.failed
    if event_type not in ['charge.success', 'charge.failed']:
        logger.info(f"Ignored non-relevant Paystack event: {event_type}")
        return HttpResponse(status=200)  # ✅ Always return 200

    data = event.get('data', {})
    reference = data.get('reference')
    amount_kobo = data.get('amount')
    status_val = data.get('status')

    if not reference:
        logger.warning("Missing reference in Paystack webhook")
        return HttpResponse(status=200)  # ✅ Always return 200

    try:
        transaction = Transaction.objects.get(paystack_reference=reference)
    except Transaction.DoesNotExist:
        logger.warning(f"Paystack transaction not found: {reference}")
        return HttpResponse(status=200)  # ✅ Always return 200

    # Update status based on event type
    if event_type == 'charge.success' and status_val == 'success':
        transaction.status = 'COMPLETED'
        logger.info(f"Paystack payment successful: {transaction.id}")
        
        # ✅ Generate receipt if payment is successful (optional)
        # try:
        #     from receipts.models import Receipt
        #     if not Receipt.objects.filter(transaction=transaction).exists():
        #         from receipts.services import ReceiptGenerator
        #         ReceiptGenerator.generate_receipt(transaction)
        # except Exception as e:
        #     logger.error(f"Failed to generate receipt: {e}")
            
    elif event_type == 'charge.failed':
        transaction.status = 'FAILED'
        logger.info(f"Paystack payment failed: {transaction.id}")
    
    # ✅ Save full webhook payload for debugging/auditing
    transaction.response_data = event
    transaction.save()
    
    logger.info(f"Paystack webhook processed: {transaction.id} -> {transaction.status}")
    
    return HttpResponse(status=200)  # ✅ Always return 200