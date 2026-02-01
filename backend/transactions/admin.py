from django.contrib import admin
from .models import Transaction

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ['id', 'initiated_by', 'amount', 'payment_method', 'status', 'created_at']
    list_filter = ['payment_method', 'status', 'created_at', 'initiated_by']
    search_fields = ['initiated_by__username', 'initiated_by__first_name', 'mpesa_checkout_request_id', 'paystack_reference']
    readonly_fields = ['created_at', 'updated_at']