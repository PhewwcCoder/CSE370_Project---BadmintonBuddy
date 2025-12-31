from django.db import models
from users.models import User

class Court(models.Model):
    court_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)

    class Meta:
        managed = False
        db_table = 'courts'

    def __str__(self):
        return self.name


class Match(models.Model):
    match_id = models.AutoField(primary_key=True)

    court = models.ForeignKey(Court, on_delete=models.CASCADE, db_column='court_id')
    player1 = models.ForeignKey(User, on_delete=models.CASCADE, db_column='player1_id', related_name='matches_as_p1')
    player2 = models.ForeignKey(User, on_delete=models.CASCADE, db_column='player2_id', related_name='matches_as_p2')

    start_time = models.DateTimeField()
    end_time = models.DateTimeField()

    tournament_id = models.IntegerField(null=True, blank=True)  # FK exists in DB; we’ll map to model later
    round = models.SmallIntegerField(null=True, blank=True)
    winner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, db_column='winner_id', related_name='wins_as_winner')
    score = models.CharField(max_length=50, null=True, blank=True)

    class Meta:
        managed = False
        db_table = 'matches'

    def __str__(self):
        return f"Match {self.match_id}"
