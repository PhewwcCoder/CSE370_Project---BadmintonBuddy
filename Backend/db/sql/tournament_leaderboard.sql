-- Tournament Leaderboard Query
-- Returns wins and matches played per participant

SELECT
    u.user_id,
    u.name,
    COUNT(DISTINCT m.match_id) AS matches_played,
    COALESCE(SUM(CASE WHEN m.winner_id = u.user_id THEN 1 ELSE 0 END), 0) AS wins
FROM tournament_participants tp
JOIN users u ON tp.user_id = u.user_id
LEFT JOIN matches m
    ON m.tournament_id = tp.tournament_id
    AND (m.player1_id = u.user_id OR m.player2_id = u.user_id)
WHERE tp.tournament_id = {TOURNAMENT_ID}
GROUP BY u.user_id
ORDER BY wins DESC;
