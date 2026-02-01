from django.urls import path
from . import views

urlpatterns = [
    path('stats/', views.DashboardStatsView.as_view(), name='dashboard-stats'),  
    path('', views.TransactionListView.as_view(), name='transaction-list'),
    path('initiate/', views.InitiatePaymentView.as_view(), name='initiate-payment'),
    path('<int:pk>/', views.TransactionDetailView.as_view(), name='transaction-detail'),
    path('webhook/daraja/', views.DarajaWebhookView.as_view(), name='daraja-webhook'),
    path('webhook/paystack/', views.PaystackWebhookView.as_view(), name='paystack-webhook'),
]