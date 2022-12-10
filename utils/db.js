const {Client} = require('pg');

const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'PhotoOrg-DB',
    password: 'test',
    port: 5432,
});
/*const client = new Client({
    connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
*/


client.connect((err) => {

    if(err) throw err;
    return console.log("PG connected");

});

const createTableText = `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) not null,
  email varchar(255) UNIQUE not null,
  password text not null
);
CREATE TABLE IF NOT EXISTS images(
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  file_name text not null,
  image_key text not null,
  thumbnail_key text not null,
  caption text,
  tags text,
  CVtags JSONB,
  searchcol_cv tsvector GENERATED ALWAYS AS (to_tsvector('english', CVtags::json)) STORED,
  searchcol_user tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(caption, '') || ' ' || coalesce(tags, ''))) STORED
);
CREATE INDEX if not exists searchcol_idx ON images USING GIN (searchcol_cv,searchcol_user);
`


client.query(createTableText)

module.exports = client;
