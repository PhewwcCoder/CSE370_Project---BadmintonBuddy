from django.db import models
from users.models import User

class Tournament(models.Model):
    tournament_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    description = models.CharField(max_length=255, null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, db_column='created_by')
    max_players = models.IntegerField()
    status = models.CharField(max_length=10)

    class Meta:
        managed = False
        db_table = 'tournaments'

    def __str__(self):
        return f"{self.name} ({self.status})"


class TournamentParticipant(models.Model):
    participant_id = models.AutoField(primary_key=True)
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, db_column='tournament_id')
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column='user_id')
    seed = models.IntegerField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = 'tournament_participants'
        unique_together = (('tournament', 'user'),)

    def __str__(self):
        return f"{self.user.name} in {self.tournament.name}"
