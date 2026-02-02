# transactions/urls.py
from django.urls import path
from . import views

urlpatterns = [
    # Dashboard & Stats
    path('stats/', views.DashboardStatsView.as_view(), name='dashboard-stats'),
    
    # Transaction CRUD
    path('', views.TransactionListView.as_view(), name='transaction-list'),
    path('<int:pk>/', views.TransactionDetailView.as_view(), name='transaction-detail'),
    
    # Payment Initiation
    path('initiate/', views.InitiatePaymentView.as_view(), name='initiate-payment'),
    
    # Manual Verification (Paystack only)
    path('paystack/verify/<str:reference>/', 
         views.VerifyPaystackTransactionView.as_view(), 
         name='verify-paystack-transaction'),
    
    # Webhooks (function-based, no .as_view())
    path('webhook/daraja/', views.daraja_webhook, name='daraja-webhook'),
    path('webhook/paystack/', views.paystack_webhook, name='paystack-webhook'),
]