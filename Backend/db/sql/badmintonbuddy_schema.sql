-- Table: User (stores players and admins)
CREATE TABLE users (
    user_id        INT PRIMARY KEY AUTO_INCREMENT,       -- Primary key for user (Django will use an auto-increment id)
    name           VARCHAR(100) NOT NULL,
    email          VARCHAR(100) NOT NULL UNIQUE,         -- Email must be unique for each user
    password       VARCHAR(255) NOT NULL,                -- Hashed password
    role           ENUM('player','admin') NOT NULL DEFAULT 'player',  -- User role
    skill_rating   INT DEFAULT 0,                        -- Numeric skill level (can be updated based on performance)
    wins           INT DEFAULT 0,                        -- Total wins (for leaderboard/stats)
    total_matches  INT DEFAULT 0                         -- Total matches played (for stats like win ratio)
);

-- Table: Court (badminton courts or venue slots that can be booked)
CREATE TABLE Court (
    court_id   INT PRIMARY KEY AUTO_INCREMENT,
    name       VARCHAR(100) NOT NULL            -- Court name or location identifier
    -- (We could add more fields like location address, etc., but keeping it simple)
);

-- Table: Tournament (competition organized by an admin)
CREATE TABLE Tournament (
    tournament_id  INT PRIMARY KEY AUTO_INCREMENT,
    name           VARCHAR(100) NOT NULL,
    description    VARCHAR(255),
    created_by     INT NOT NULL,                          -- FK to User (admin organizer)
    max_players    INT NOT NULL,
    status         ENUM('upcoming','ongoing','completed') NOT NULL DEFAULT 'upcoming',
    FOREIGN KEY (created_by) REFERENCES User(user_id)
);

-- Table: TournamentParticipant (join table linking Users to Tournaments)
CREATE TABLE TournamentParticipant (
    participant_id  INT PRIMARY KEY AUTO_INCREMENT,
    tournament_id   INT NOT NULL,
    user_id         INT NOT NULL,
    seed            INT,
    FOREIGN KEY (tournament_id) REFERENCES Tournament(tournament_id),
    FOREIGN KEY (user_id) REFERENCES User(user_id),
    UNIQUE KEY unique_participation (tournament_id, user_id)  -- prevent duplicate user in a tournament:contentReference[oaicite:12]{index=12}
);

-- Table: Match (scheduled match, for casual play or tournament rounds)
CREATE TABLE Match (
    match_id       INT PRIMARY KEY AUTO_INCREMENT,
    court_id       INT NOT NULL,
    player1_id     INT NOT NULL,
    player2_id     INT NOT NULL,
    start_time     DATETIME NOT NULL,
    end_time       DATETIME NOT NULL,
    tournament_id  INT,                                   -- FK to Tournament (null if a friendly match)
    round          TINYINT,                               -- Round number (if part of a tournament)
    winner_id      INT,                                   -- FK to User (null until match is played)
    score          VARCHAR(50),                           -- Score/result (null until match is played)
    FOREIGN KEY (court_id) REFERENCES Court(court_id),
    FOREIGN KEY (player1_id) REFERENCES User(user_id),
    FOREIGN KEY (player2_id) REFERENCES User(user_id),
    FOREIGN KEY (tournament_id) REFERENCES Tournament(tournament_id),
    FOREIGN KEY (winner_id) REFERENCES User(user_id)
    /* Ensure no overlapping bookings via application logic (not enforced by constraint) */
);

-- Table: GoogleCalendarCred (OAuth2 credentials for Google Calendar integration)
CREATE TABLE GoogleCalendarCred (
    user_id              INT PRIMARY KEY,    -- One-to-one relation with User
    google_account_email VARCHAR(100),
    access_token         TEXT,
    refresh_token        TEXT,
    token_expiry         DATETIME,
    FOREIGN KEY (user_id) REFERENCES User(user_id)
);


