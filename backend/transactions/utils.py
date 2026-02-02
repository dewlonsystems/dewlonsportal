import requests
import base64
import json
from django.conf import settings
from django.core.cache import cache
from decouple import config
from django.utils import timezone
from decimal import Decimal, InvalidOperation

# ====== Daraja (M-Pesa) Config ======
DARAJA_CONSUMER_KEY = config('DARAJA_CONSUMER_KEY', default='').strip()
DARAJA_CONSUMER_SECRET = config('DARAJA_CONSUMER_SECRET', default='').strip()
DARAJA_SHORTCODE = config('DARAJA_SHORTCODE', default='').strip()
DARAJA_PASSKEY = config('DARAJA_PASSKEY', default='').strip()
DARAJA_CALLBACK_URL = config('DARAJA_CALLBACK_URL', default='https://api.dewlons.com/api/transactions/webhook/daraja/').strip()
DARAJA_TILLNUMBER = config('DARAJA_TILLNUMBER', default='').strip()

# ====== Paystack Config ======
PAYSTACK_SECRET_KEY = config('PAYSTACK_SECRET_KEY', default='').strip()


def normalize_phone_number(phone):
    """
    Converts phone number to valid Safaricom format: 254XXXXXXXXX
    Accepts inputs like 0712345678, +254712345678, 254712345678, etc.
    Returns normalized string or raises ValueError.
    """
    if not phone:
        raise ValueError("Phone number is empty")
    
    # Remove all non-digit characters
    digits = ''.join(filter(str.isdigit, str(phone)))

    if digits.startswith('0') and len(digits) == 10:
        digits = '254' + digits[1:]
    elif digits.startswith('254') and len(digits) == 12:
        pass  # already correct
    elif len(digits) == 9:
        # Assume local number without leading 0 (e.g., 712345678)
        digits = '254' + digits
    else:
        raise ValueError("Invalid phone number format. Must be a Kenyan number.")

    if len(digits) != 12 or not digits.startswith('254'):
        raise ValueError("Phone number must be 12 digits and start with 254")

    return digits


def get_daraja_token():
    """
    Get OAuth access token for Daraja API with caching
    """
    token = cache.get('daraja_access_token')
    if token:
        return token

    url = 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'.strip()
    credentials = base64.b64encode(f"{DARAJA_CONSUMER_KEY}:{DARAJA_CONSUMER_SECRET}".encode()).decode()
    headers = {'Authorization': f'Basic {credentials}'}
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        token = response.json().get('access_token')
        if token:
            cache.set('daraja_access_token', token, timeout=3500)
            return token
        else:
            raise Exception("No access token in response")
            
    except requests.exceptions.RequestException as e:
        raise Exception(f"Failed to get Daraja token: {str(e)}")
    except json.JSONDecodeError:
        raise Exception("Invalid JSON response from Daraja token endpoint")


def send_stk_push(phone_number, amount, transaction_id):
    """
    Initiates STK Push via Daraja API.
    Returns dict with 'success' boolean and optional 'CheckoutRequestID' or 'error'.
    """
    try:
        phone_number = normalize_phone_number(phone_number)
        token = get_daraja_token()
        
        timestamp = timezone.now().strftime('%Y%m%d%H%M%S')
        password = base64.b64encode(
            f"{DARAJA_SHORTCODE}{DARAJA_PASSKEY}{timestamp}".encode()
        ).decode()

        payload = {
            "BusinessShortCode": DARAJA_SHORTCODE,
            "Password": password,
            "Timestamp": timestamp,
            "TransactionType": "CustomerBuyGoodsOnline",
            "Amount": int(amount),
            "PartyA": phone_number,
            "PartyB": DARAJA_TILLNUMBER,
            "PhoneNumber": phone_number,
            "CallBackURL": DARAJA_CALLBACK_URL.rstrip('/'),
            "AccountReference": f"TXN{transaction_id}",
            "TransactionDesc": "Payment for service"
        }

        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }

        url = 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'.strip()
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        
        result = response.json()
        
        if response.status_code == 200 and result.get('ResponseCode') == '0':
            return {
                'success': True,
                'CheckoutRequestID': result.get('CheckoutRequestID'),
                'CustomerMessage': result.get('CustomerMessage', 'Request sent to your phone')
            }
        else:
            error_msg = result.get('errorMessage', result.get('message', 'Unknown error from Daraja'))
            return {
                'success': False,
                'error': error_msg,
                'raw_response': result
            }
            
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


def query_daraja_transaction_status(checkout_request_id):
    """
    Query the status of an STK Push transaction from Daraja
    Returns dict with transaction status details
    """
    try:
        token = get_daraja_token()
        
        timestamp = timezone.now().strftime('%Y%m%d%H%M%S')
        password = base64.b64encode(
            f"{DARAJA_SHORTCODE}{DARAJA_PASSKEY}{timestamp}".encode()
        ).decode()

        payload = {
            "BusinessShortCode": DARAJA_SHORTCODE,
            "Password": password,
            "Timestamp": timestamp,
            "CheckoutRequestID": checkout_request_id
        }

        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }

        url = 'https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query'.strip()
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        
        result = response.json()
        
        return {
            'success': response.status_code == 200,
            'data': result,
            'status_code': response.status_code
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


def register_daraja_urls(validation_url, confirmation_url):
    """
    Register callback URLs with Safaricom for C2B transactions
    """
    try:
        token = get_daraja_token()
        
        payload = {
            "ValidationURL": validation_url.rstrip('/'),
            "ConfirmationURL": confirmation_url.rstrip('/'),
            "ResponseType": "Completed",
            "BusinessShortCode": DARAJA_SHORTCODE
        }

        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }

        url = 'https://api.safaricom.co.ke/mpesa/c2b/v1/registerurl'.strip()
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        
        result = response.json()
        
        return {
            'success': response.status_code == 200,
            'data': result
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


def initialize_paystack_transaction(email, amount, reference, metadata=None):
    """
    Initializes a Paystack transaction and returns the authorization URL.
    Amount should be a Decimal or float in **local currency (e.g., KES)**.
    Returns dict with 'success', 'authorization_url', or 'error'.
    """
    try:
        # Validate amount
        try:
            amount_decimal = Decimal(str(amount))
            if amount_decimal <= 0:
                return {
                    'success': False,
                    'error': 'Amount must be greater than 0'
                }
        except (InvalidOperation, ValueError):
            return {
                'success': False,
                'error': 'Invalid amount format'
            }

        url = "https://api.paystack.co/transaction/initialize".strip()
        headers = {
            "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
            "Content-Type": "application/json",
        }
        
        data = {
            "email": email.strip(),
            "amount": int(amount_decimal * 100),  # Convert to kobo
            "reference": reference.strip(),
            "callback_url": "https://portal.dewlons.com/payments".strip(),
            "metadata": metadata or {},
        }
        
        response = requests.post(url, json=data, headers=headers, timeout=30)
        result = response.json()

        if response.status_code == 200 and result.get('status'):
            return {
                'success': True,
                'authorization_url': result['data']['authorization_url'],
                'reference': result['data']['reference']
            }
        else:
            error_msg = result.get('message', 'Unknown error from Paystack')
            return {
                'success': False,
                'error': error_msg,
                'raw_response': result
            }
            
    except requests.exceptions.RequestException as e:
        return {
            'success': False,
            'error': f'Network error: {str(e)}'
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


def verify_paystack_transaction(reference):
    """
    Verify a Paystack transaction using the Paystack API
    Useful for manual verification (not needed in webhook if you trust events)
    Returns dict with verification result
    """
    try:
        url = f"https://api.paystack.co/transaction/verify/{reference}".strip()
        headers = {
            'Authorization': f'Bearer {PAYSTACK_SECRET_KEY}'
        }
        
        response = requests.get(url, headers=headers, timeout=30)
        
        if response.status_code == 200:
            return {
                'success': True,
                'data': response.json()
            }
        else:
            return {
                'success': False,
                'status_code': response.status_code,
                'error': f'Paystack returned status {response.status_code}'
            }
            
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }