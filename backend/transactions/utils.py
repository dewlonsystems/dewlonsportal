import requests
import base64
import json
from django.conf import settings
from django.core.cache import cache
from decouple import config
from django.utils import timezone
from decimal import Decimal

# ====== Daraja (M-Pesa) Config ======
DARAJA_CONSUMER_KEY = config('DARAJA_CONSUMER_KEY', default='')
DARAJA_CONSUMER_SECRET = config('DARAJA_CONSUMER_SECRET', default='')
DARAJA_SHORTCODE = config('DARAJA_SHORTCODE', default='')
DARAJA_PASSKEY = config('DARAJA_PASSKEY', default='')
DARAJA_CALLBACK_URL = config('DARAJA_CALLBACK_URL', default='https://api.dewlons.com/api/transactions/webhook/daraja/')
DARAJA_TILLNUMBER = config('DARAJA_TILLNUMBER', default='')

# ====== Paystack Config ======
PAYSTACK_SECRET_KEY = config('PAYSTACK_SECRET_KEY', default='')


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
    token = cache.get('daraja_access_token')
    if token:
        return token

    url = 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
    credentials = base64.b64encode(f"{DARAJA_CONSUMER_KEY}:{DARAJA_CONSUMER_SECRET}".encode()).decode()
    headers = {'Authorization': f'Basic {credentials}'}
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        token = response.json().get('access_token')
        cache.set('daraja_access_token', token, timeout=3500)
        return token
    else:
        raise Exception("Failed to get Daraja token")


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
            "CallBackURL": DARAJA_CALLBACK_URL.rstrip('/'),  # Ensure no trailing slash issues
            "AccountReference": f"TXN{transaction_id}",
            "TransactionDesc": "Payment for service"
        }

        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }

        response = requests.post(
            'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
            json=payload,
            headers=headers
        )

        result = response.json()
        if response.status_code == 200 and result.get('ResponseCode') == '0':
            return {
                'success': True,
                'CheckoutRequestID': result.get('CheckoutRequestID')
            }
        else:
            return {
                'success': False,
                'error': result.get('errorMessage', 'Unknown error from Daraja')
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
        url = "https://api.paystack.co/transaction/initialize"
        headers = {
            "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
            "Content-Type": "application/json",
        }
        data = {
            "email": email,
            "amount": int(Decimal(amount) * 100),  # Convert to kobo
            "reference": reference,
            "callback_url": "https://portal.dewlons.com/payments",  # Optional: your success page
            "metadata": metadata or {},
        }
        response = requests.post(url, json=data, headers=headers)
        result = response.json()

        if response.status_code == 200 and result.get('status'):
            return {
                'success': True,
                'authorization_url': result['data']['authorization_url']
            }
        else:
            error_msg = result.get('message', 'Unknown error from Paystack')
            return {
                'success': False,
                'error': error_msg
            }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


def verify_paystack_transaction(reference):
    """Useful for manual verification (not needed in webhook if you trust events)."""
    headers = {'Authorization': f'Bearer {PAYSTACK_SECRET_KEY}'}
    response = requests.get(f'https://api.paystack.co/transaction/verify/{reference}', headers=headers)
    if response.status_code == 200:
        return response.json()
    return None