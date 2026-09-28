import "dotenv/config";
import pool from "./db.js";

async function testDatabase() {
  try {
    const result = await pool.query(`
      SELECT
        current_database() AS database,
        current_user AS user,
        NOW() AS time
    `);

    console.log("✅ Supabase connected!");
    console.log(result.rows[0]);
  } catch (error) {
    console.error("❌ Supabase connection failed:");
    console.error(error.message);
  } finally {
    await pool.end();
  }
}

testDatabase();
