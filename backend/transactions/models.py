from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

class Transaction(models.Model):
    PAYMENT_METHOD_CHOICES = [
        ('STK_PUSH', 'STK Push (MPesa)'),
        ('PAYSTACK', 'Paystack'),
    ]

    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PROCESSING', 'Processing'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
    ]

    # Who initiated this transaction
    initiated_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='transactions'
    )

    # Payment details
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')

    # External reference IDs (from MPesa or Paystack)
    mpesa_checkout_request_id = models.CharField(max_length=100, blank=True, null=True)  # For STK Push
    paystack_reference = models.CharField(max_length=100, blank=True, null=True)         # For Paystack

    # Optional: phone number or email used in payment
    customer_identifier = models.CharField(max_length=50, blank=True, help_text="Phone (for MPesa) or Email (for Paystack)")

    # Timestamps
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['initiated_by', 'status']),
            models.Index(fields=['payment_method', 'status']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.get_payment_method_display()} - {self.amount} ({self.get_status_display()}) by {self.initiated_by.first_name or self.initiated_by.username}"