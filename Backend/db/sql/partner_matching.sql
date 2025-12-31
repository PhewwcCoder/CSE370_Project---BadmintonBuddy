-- Find up to 5 candidate partners for a given user and time slot

SELECT u.user_id, u.name, u.skill_rating
FROM users AS u
WHERE u.user_id != :current_user_id
  AND u.role = 'player'
  AND ABS(u.skill_rating - :current_user_skill) <= 2
  AND NOT EXISTS (
      SELECT 1
      FROM matches AS m
      WHERE (m.player1_id = u.user_id OR m.player2_id = u.user_id)
        AND NOT (m.end_time <= :requested_start
                 OR m.start_time >= :requested_end)
  )
LIMIT 5;
