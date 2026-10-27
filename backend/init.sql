-- Use the database created by Docker Compose environment variables
USE cloudeats_db;

-- Create menu_items table
CREATE TABLE IF NOT EXISTS menu_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  category    VARCHAR(100) NOT NULL,
  price       DECIMAL(10, 2) NOT NULL,
  description TEXT,
  badge       VARCHAR(50),
  rating      DECIMAL(2,1) DEFAULT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed sample menu items (only insert if table is empty)
INSERT IGNORE INTO menu_items (id, name, category, price, description, badge) VALUES
  (1, 'Nasi Lemak Special',    'Breakfast', 12.00, 'Fragrant coconut rice with sambal, fried chicken, egg & peanuts', 'Best Seller'),
  (2, 'Nasi Lemak Regular',    'Breakfast',  8.00, 'Classic nasi lemak with sambal, anchovies & half egg',           NULL),
  (3, 'Roti Canai with Curry', 'Breakfast',  6.00, 'Crispy flaky flatbread with aromatic chicken curry dip',         NULL),
  (4, 'Char Kway Teow',        'Mains',     14.00, 'Stir-fried flat noodles with prawns, egg & bean sprouts',        'New'),
  (5, 'Mee Goreng Mamak',      'Mains',     11.00, 'Yellow noodles fried with tofu, squid & tomato sauce',           NULL),
  (6, 'Teh Tarik',             'Beverages',  3.00, 'Pulled milk tea — sweet, frothy, and perfectly Malaysian',        NULL),
  (7, 'Milo Ais',              'Beverages',  4.00, 'Iced Milo with condensed milk — the Malaysian childhood drink',   NULL);

-- Laksa (added in Lab 6.1)
INSERT INTO menu_items (name, category, price, description, badge, rating)
VALUES ('Laksa', 'Noodles', 9.50, 'Spicy coconut noodle soup with prawns and tofu puffs', NULL, 4.5);
