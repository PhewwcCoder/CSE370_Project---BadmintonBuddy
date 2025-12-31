from django.urls import path
from . import views

urlpatterns = [
    path('signup/', views.signup, name='signup'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('calendar/connect/', views.calendar_connect, name='calendar_connect'),
    path('calendar/status/', views.calendar_status, name='calendar_status'),
    path("stats/", views.user_stats, name="user_stats"),

]
