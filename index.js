import express from 'express';
import bodyParser from 'body-parser';
import pg from 'pg';
import dotenv from "dotenv";
dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

let currentUserId = 1;

async function getUsers() {
    const result = await db.query('SELECT * FROM users ORDER BY id ASC');
    return result.rows;
}
async function checkVisited() {
    const result = await db.query(
        'SELECT country_code FROM visited_countries where user_id = $1',
        [currentUserId],
    );
    let countries = [];
    result.rows.forEach((country) => {
        countries.push(country.country_code);
    });
    return countries;
}
app.get('/', async (req, res) => {
    const users = await getUsers();
    if (users.length === 0) {
        return res.render('new.ejs');
    }
    const currentUser = users.find((user) => user.id === currentUserId);
    const countries = await checkVisited();
    res.render('index.ejs', {
        countries: countries,
        total: countries.length,
        users: users,
        color: currentUser.color,
    });
});
app.post('/add', async (req, res) => {
    const input = req.body.country?.trim();

    try {
        const result = await db.query(
            "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';",
            [input.toLowerCase()]
        );

        if (result.rows.length === 0) {
            console.log("Country not found:", input);
            return res.redirect("/");
        }

        const countryCode = result.rows[0].country_code;

        try {
            await db.query(
                'INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)',
                [countryCode, currentUserId]
            );

            res.redirect("/");
        } catch (err) {
            console.log("Insert error:", err);
            res.redirect("/");
        }

    } catch (err) {
        console.log("Search error:", err);
        res.redirect("/");
    }
});
app.post('/user', async (req, res) => {
    const person_id = req.body.user;
    if (req.body.add === 'new') {
        res.render('new.ejs');
    } else {
        currentUserId = Number(req.body.user);
        res.redirect('/');
    }
});

app.post('/new', async (req, res) => {
    const name = req.body.name;
    const color_name = req.body.color;
    const result = await db.query(
        'INSERT INTO users(name,color) VALUES ($1,$2) RETURNING id',
        [name, color_name],
    );
    currentUserId = result.rows[0].id;
    res.redirect('/');
    //Hint: The RETURNING keyword can return the data that was inserted.
    //https://www.postgresql.org/docs/current/dml-returning.html
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
