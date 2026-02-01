import requests
import base64
import json
from django.conf import settings
from django.core.cache import cache
from decouple import config

# Daraja credentials (from .env)
DARAJA_CONSUMER_KEY = config('DARAJA_CONSUMER_KEY', default='')
DARAJA_CONSUMER_SECRET = config('DARAJA_CONSUMER_SECRET', default='')
DARAJA_SHORTCODE = config('DARAJA_SHORTCODE', default='')
DARAJA_PASSKEY = config('DARAJA_PASSKEY', default='')
DARAJA_CALLBACK_URL = config('DARAJA_CALLBACK_URL', default='http://localhost:8000/api/transactions/webhook/daraja/')

def get_daraja_token():
    token = cache.get('daraja_access_token')
    if token:
        return token

    url = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
    credentials = base64.b64encode(f"{DARAJA_CONSUMER_KEY}:{DARAJA_CONSUMER_SECRET}".encode()).decode()
    headers = {'Authorization': f'Basic {credentials}'}
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        token = response.json().get('access_token')
        cache.set('daraja_access_token', token, timeout=3500)  # expires in 1 hour
        return token
    else:
        raise Exception("Failed to get Daraja token")

def send_stk_push(phone_number, amount, transaction_id):
    """
    Initiates STK Push via Daraja API.
    Returns dict with 'success' boolean and optional 'CheckoutRequestID' or 'error'.
    """
    try:
        token = get_daraja_token()
        timestamp = timezone.now().strftime('%Y%m%d%H%M%S')
        password = base64.b64encode(
            f"{DARAJA_SHORTCODE}{DARAJA_PASSKEY}{timestamp}".encode()
        ).decode()

        callback_url = DARAJA_CALLBACK_URL
        payload = {
            "BusinessShortCode": DARAJA_SHORTCODE,
            "Password": password,
            "Timestamp": timestamp,
            "TransactionType": "CustomerPayBillOnline",
            "Amount": int(amount),
            "PartyA": phone_number,
            "PartyB": DARAJA_SHORTCODE,
            "PhoneNumber": phone_number,
            "CallBackURL": callback_url,
            "AccountReference": f"TXN{transaction_id}",
            "TransactionDesc": "Payment for service"
        }

        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }

        response = requests.post(
            'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
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
                'error': result.get('errorMessage', 'Unknown error')
            }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

def verify_paystack_transaction(reference):
    """Not used in webhook (we trust Paystack), but useful for polling."""
    secret = config('PAYSTACK_SECRET_KEY', '')
    headers = {'Authorization': f'Bearer {secret}'}
    response = requests.get(f'https://api.paystack.co/transaction/verify/{reference}', headers=headers)
    return response.json() if response.status_code == 200 else None