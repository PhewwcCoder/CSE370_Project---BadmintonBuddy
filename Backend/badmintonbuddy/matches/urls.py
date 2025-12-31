from django.urls import path
from . import views

urlpatterns = [
    path("partners/", views.find_partners, name="find_partners"),
    path("book/", views.book_match, name="book_match"),
    path("history/", views.match_history, name="match_history"),

    # open-slot feature 
    path("open/", views.open_slots, name="open_slots"),
    path("<int:match_id>/join/", views.join_slot, name="join_slot"),

    # ✅ calendar agenda
    path("by-day/", views.matches_by_day, name="matches_by_day"),
]



