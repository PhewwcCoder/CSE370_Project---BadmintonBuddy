from django.urls import path
from . import views

urlpatterns = [
    path("", views.list_tournaments, name="list_tournaments"),
    path("create/", views.create_tournament, name="create_tournament"),

    path("<int:tournament_id>/join/", views.join_tournament, name="join_tournament"),
    path("<int:tournament_id>/start/", views.start_tournament, name="start_tournament"),
    path("<int:tournament_id>/matches/", views.tournament_matches, name="tournament_matches"),

    path("match/<int:match_id>/result/", views.report_match_result, name="report_match_result"),

    path("leaderboard/", views.leaderboard, name="global_leaderboard"),
    path("<int:tournament_id>/leaderboard/", views.tournament_leaderboard, name="tournament_leaderboard"),
    path("<int:tournament_id>/complete/", views.complete_tournament, name="complete_tournament"),

]




