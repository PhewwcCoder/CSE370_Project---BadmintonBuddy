from django.db import models

class User(models.Model):
    user_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=255)
    role = models.CharField(max_length=10)
    skill_rating = models.IntegerField(default=0)
    wins = models.IntegerField(default=0)
    total_matches = models.IntegerField(default=0)

    class Meta:
        managed = False
        db_table = 'users'

    def __str__(self):
        return f"{self.name} ({self.email})"


class GoogleCalendarCred(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        db_column='user_id',
        primary_key=True,
        related_name='google_creds'
    )
    google_account_email = models.CharField(max_length=100, null=True, blank=True)
    access_token = models.TextField(null=True, blank=True)
    refresh_token = models.TextField(null=True, blank=True)
    token_expiry = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = 'google_calendar_creds'

    def __str__(self):
        return f"GoogleCred({self.user.email})"


    
