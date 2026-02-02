from django.urls import path
from . import views

urlpatterns = [
    path('stats/', views.DashboardStatsView.as_view(), name='dashboard-stats'),  
    path('', views.TransactionListView.as_view(), name='transaction-list'),
    path('initiate/', views.InitiatePaymentView.as_view(), name='initiate-payment'),
    path('<int:pk>/', views.TransactionDetailView.as_view(), name='transaction-detail'),
    # Webhooks: now function-based (no .as_view())
    path('webhook/daraja/', views.daraja_webhook, name='daraja-webhook'),
    path('webhook/paystack/', views.paystack_webhook, name='paystack-webhook'),
    path('paystack/verify/<str:reference>/', 
         views.VerifyPaystackTransactionView.as_view(), 
         name='verify_paystack_transaction'),
]