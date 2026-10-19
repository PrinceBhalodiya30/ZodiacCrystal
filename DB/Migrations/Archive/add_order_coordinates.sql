-- Optional map pin for the shipping address, picked on the checkout map.
-- NULL for orders placed without using the map (and all existing orders).

ALTER TABLE Orders ADD Latitude DECIMAL(9, 6) NULL;
ALTER TABLE Orders ADD Longitude DECIMAL(9, 6) NULL;
