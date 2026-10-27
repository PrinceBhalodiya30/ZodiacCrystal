-- Optional map pin for saved addresses, picked on the address book map.
-- Carried onto orders placed with that saved address.

ALTER TABLE Addresses ADD Latitude DECIMAL(9, 6) NULL;
ALTER TABLE Addresses ADD Longitude DECIMAL(9, 6) NULL;
