import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// BUG: SQL injection! User input is concatenated directly into the query.
export async function getUserById(userId) {
  const query = `SELECT * FROM users WHERE id = '${userId}'`;
  const result = await pool.query(query);
  return result.rows[0];
}

export async function searchUsers(name) {
  const query = "SELECT * FROM users WHERE name = '" + name + "'";
  const result = await pool.query(query);
  return result.rows;
}
