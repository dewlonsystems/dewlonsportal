import logging
import json
from decimal import Decimal
from django.conf import settings
from django.contrib.auth.models import User
from django.http import HttpResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from .models import Transaction
from .utils import send_stk_push, verify_paystack_transaction
from django.db.models import Sum
from datetime import datetime, timedelta
import calendar


# >>> INSERT THIS CLASS AFTER IMPORTS AND BEFORE TransactionListView <<<
class DashboardStatsView(APIView):
    def get(self, request):
        user = request.user
        # Parse optional date range
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
            # Default: last 30 days
            end_date = timezone.now().date()
            start_date = end_date - timedelta(days=29)

        # Build base queryset
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

        # Total collected
        total = queryset.aggregate(total=Sum('amount'))['total'] or 0

        # Daily trend data
        from django.db.models import Count
        daily_data = (
            queryset
            .extra(select={'date': "DATE(created_at)"})
            .values('date')
            .annotate(amount=Sum('amount'))
            .order_by('date')
        )

        # Ensure all dates in range are present (fill missing with 0)
        from collections import OrderedDict
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
            'trend': list(trend.items())  # List of [date, amount] pairs
        })

logger = logging.getLogger(__name__)

class TransactionListView(APIView):
    def get(self, request):
        user = request.user
        if user.is_superuser:
            transactions = Transaction.objects.all()
        else:
            transactions = Transaction.objects.filter(initiated_by=user)
        
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
            })
        return Response(data)

class TransactionDetailView(APIView):
    def get(self, request, pk):
        try:
            transaction = Transaction.objects.get(pk=pk)
        except Transaction.DoesNotExist:
            return Response({'error': 'Transaction not found'}, status=status.HTTP_404_NOT_FOUND)

        # Enforce visibility
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
        })

class InitiatePaymentView(APIView):
    def post(self, request):
        user = request.user
        payment_method = request.data.get('payment_method')
        amount = request.data.get('amount')
        customer_identifier = request.data.get('customer_identifier')  # phone for MPesa, email for Paystack

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

        # Create pending transaction
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

        if payment_method == 'STK_PUSH':
            # Initiate STK Push via Daraja
            phone = customer_identifier
            result = send_stk_push(phone, float(amount), transaction.id)
            if result.get('success'):
                transaction.mpesa_checkout_request_id = result.get('CheckoutRequestID')
                transaction.save()
                response_data['checkout_request_id'] = result.get('CheckoutRequestID')
            else:
                transaction.status = 'FAILED'
                transaction.save()
                return Response(
                    {'error': 'Failed to initiate STK Push', 'details': result.get('error')},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        elif payment_method == 'PAYSTACK':
            # Return Paystack checkout URL (frontend redirects)
            from uuid import uuid4
            reference = str(uuid4())
            transaction.paystack_reference = reference
            transaction.save()
            response_data['paystack_reference'] = reference
            response_data['checkout_url'] = f"https://paystack.com/pay/{reference}"  # frontend will use this

        return Response(response_data, status=status.HTTP_201_CREATED)

@method_decorator(csrf_exempt, name='dispatch')
class DarajaWebhookView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        logger.info("Received Daraja webhook")
        try:
            payload = json.loads(request.body)
        except json.JSONDecodeError:
            return HttpResponse(status=400)

        # Extract key fields
        checkout_request_id = payload.get('Body', {}).get('stkCallback', {}).get('CheckoutRequestID')
        result_code = payload.get('Body', {}).get('stkCallback', {}).get('ResultCode')
        result_desc = payload.get('Body', {}).get('stkCallback', {}).get('ResultDesc', '')

        if not checkout_request_id:
            logger.warning("Missing CheckoutRequestID in Daraja webhook")
            return HttpResponse(status=400)

        try:
            transaction = Transaction.objects.get(mpesa_checkout_request_id=checkout_request_id)
        except Transaction.DoesNotExist:
            logger.warning(f"Transaction not found for CheckoutRequestID: {checkout_request_id}")
            return HttpResponse(status=404)

        if result_code == 0:
            transaction.status = 'COMPLETED'
        else:
            transaction.status = 'FAILED'

        transaction.save()
        logger.info(f"Daraja webhook processed: {transaction.id} -> {transaction.status}")
        return HttpResponse("OK")

@method_decorator(csrf_exempt, name='dispatch')
class PaystackWebhookView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        logger.info("Received Paystack webhook")
        secret = getattr(settings, 'PAYSTACK_SECRET_KEY', None)
        if not secret:
            logger.error("PAYSTACK_SECRET_KEY not set")
            return HttpResponse(status=500)

        signature = request.headers.get('x-paystack-signature')
        if not signature:
            return HttpResponse(status=400)

        # Verify signature (optional but recommended)
        import hmac
        import hashlib
        computed_signature = hmac.new(
            secret.encode('utf-8'),
            request.body,
            hashlib.sha512
        ).hexdigest()

        if signature != computed_signature:
            logger.warning("Invalid Paystack signature")
            return HttpResponse(status=400)

        try:
            event = json.loads(request.body)
        except json.JSONDecodeError:
            return HttpResponse(status=400)

        if event.get('event') != 'charge.success':
            return HttpResponse("Ignored non-success event", status=200)

        data = event.get('data', {})
        reference = data.get('reference')
        amount_kobo = data.get('amount')
        status = data.get('status')

        if not reference or not amount_kobo:
            return HttpResponse(status=400)

        try:
            transaction = Transaction.objects.get(paystack_reference=reference)
        except Transaction.DoesNotExist:
            logger.warning(f"Paystack transaction not found: {reference}")
            return HttpResponse(status=404)

        # Convert kobo to decimal
        amount_paid = Decimal(amount_kobo) / 100
        if abs(transaction.amount - amount_paid) > Decimal('0.01'):
            logger.warning(f"Amount mismatch: expected {transaction.amount}, got {amount_paid}")

        if status == 'success':
            transaction.status = 'COMPLETED'
        else:
            transaction.status = 'FAILED'

        transaction.save()
        logger.info(f"Paystack webhook processed: {transaction.id} -> {transaction.status}")
        return HttpResponse("OK")