ALTER TABLE users
    ADD CONSTRAINT users_coordinates_unique
    UNIQUE (koordinate_x, koordinate_y);