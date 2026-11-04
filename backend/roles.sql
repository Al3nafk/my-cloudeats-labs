-- Roles: customer (default), owner, admin
ALTER TABLE users
  ADD COLUMN role ENUM('customer','owner','admin') NOT NULL DEFAULT 'customer';
