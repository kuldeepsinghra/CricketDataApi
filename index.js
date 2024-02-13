const express = require('express');
const { Pool } = require('pg');
const fs = require('fs');
const request = require('request');

const app = express();
const port = 3000;

// Db connection configuration
const pool = new Pool({
    user: 'your_username',
    host: 'localhost',
    database: 'postgres',
    password: 'Your_password',
    port: 5432, // default pg port
});

// Load match data from json file
const jsonData = fs.readFileSync('data.json');
const matches = JSON.parse(jsonData);

// Function to fetch data from third party api and fetch them.
const fetchDataFromAPI = () => {
    // Assuming the API endpoint is 
    const apiUrl = 'https://rest.entitysport.com/v2/matches/?status=2&token=ec471071441bb2ac538a0ff901abd249';

    request(apiUrl, { json: true }, (error, response, body) => {
        if (error) {
            console.error('Error fetching data from API:', error);
            return;
        }

        // Assuming the response body contains the match data in JSON format
        const apiMatches = body.response.items;
        console.log('body----------', body.response.items);
        // Insert data into the database
        insertMatchesIntoDB(apiMatches);
    });
};

// Function to insert matches into the database
const insertMatchesIntoDB = async (matches) => {
    if (!Array.isArray(matches)) {
        console.error('Error: Data from API is not in expected format');
        return;
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        for (const match of matches) {
            const { teama, teamb, venue, ...matchData } = match;

            // Insert or retrieve teama_id and teamb_id
            const teamAQuery = await client.query('INSERT INTO teams (name, short_name, logo_url) VALUES ($1, $2, $3) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING team_id', [teama.name, teama.short_name, teama.logo_url]);
             const teamAId = teamAQuery.rows[0].team_id;

            const teamBQuery = await client.query('INSERT INTO teams (name, short_name, logo_url) VALUES ($1, $2, $3) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING team_id', [teamb.name, teamb.short_name, teamb.logo_url]);
            const teamBId = teamBQuery.rows[0].team_id;

            // Insert or retrieve venue_id
            const venueQuery = await client.query('INSERT INTO venues (name, location, country, timezone) VALUES ($1, $2, $3, $4) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING venue_id', [venue.name, venue.location, venue.country, venue.timezone]);
            const venueId = venueQuery.rows[0].venue_id;

            // Insert match data
            await client.query('INSERT INTO matches (title, short_title, subtitle, match_number, teama_id, teamb_id, date_start, date_end, venue_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [matchData.title, matchData.short_title, matchData.subtitle, matchData.match_number, teamAId, teamBId, matchData.date_start, matchData.date_end, venueId]);
        }

        await client.query('COMMIT');
        console.log('Data inserted successfully');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error inserting data into table', error);
    } finally {
        client.release();
    }
};

// Create table in PostgreSQL if not exist
pool.query(`
    CREATE TABLE IF NOT EXISTS venues (
        venue_id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        location VARCHAR(255),
        country VARCHAR(255),
        timezone VARCHAR(50)
    );

    CREATE TABLE IF NOT EXISTS teams (
        team_id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        short_name VARCHAR(50),
        logo_url VARCHAR(255)
    );

    CREATE TABLE IF NOT EXISTS matches (
        match_id SERIAL PRIMARY KEY,
        title VARCHAR(255),
        short_title VARCHAR(50),
        subtitle VARCHAR(255),
        match_number VARCHAR(10),
        teama_id INT REFERENCES teams(team_id),
        teamb_id INT REFERENCES teams(team_id),
        date_start TIMESTAMP,
        date_end TIMESTAMP,
        venue_id INT REFERENCES venues(venue_id)
    );
  
    ALTER TABLE teams ADD CONSTRAINT teams_name_unique UNIQUE (name);
    ALTER TABLE venues ADD CONSTRAINT venues_name_unique UNIQUE (name);

`, (err, result) => {//int the uuper i used unique name constraint so table name is unique
    if (err) {
        console.error('Error creating table', err);
    } else {
        console.log('Table created successfully');
        // Fetch data from third-party API and insert into the database
        fetchDataFromAPI();
    }
});

// Route to fetch match list
app.get('/matches', async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT * FROM matches INNER JOIN teams AS teama ON matches.teama_id = teama.team_id INNER JOIN teams AS teamb ON matches.teamb_id = teamb.team_id INNER JOIN venues ON matches.venue_id = venues.venue_id');
        const formattedMatches = result.rows.map(match => ({
            match_id: match.match_id,
            title: match.title,
            short_title: match.short_title,
            subtitle: match.subtitle,
            match_number: match.match_number,
            teama: {
                team_id: match.teama_id,
                name: match.teama_name,
                short_name: match.teama_short_name,
                logo_url: match.teama_logo_url,
            },
            teamb: {
                team_id: match.teamb_id,
                name: match.teamb_name,
                short_name: match.teamb_short_name,
                logo_url: match.teamb_logo_url,
            },
            date_start: match.date_start.toISOString(),
            date_end: match.date_end.toISOString(),
            venue: {
                venue_id: match.venue_id,
                name: match.venue_name,
                location: match.venue_location,
                country: match.venue_country,
                timezone: match.venue_timezone,
            },
        }));
        client.release();

        res.json({ status: 'ok', response: { items: formattedMatches } });
    } catch (err) {
        console.error('Error executing query', err);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
});
// Route to fetch team list
app.get('/teams', async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT * FROM teams');
        const teams = result.rows;
        client.release();
        res.json({ status: 'ok', response: { items: teams } });
    } catch (err) {
        console.error('Error executing query', err);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
});

// Route to fetch venue list
app.get('/venues', async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT * FROM venues');
        const venues = result.rows;
        client.release();
        res.json({ status: 'ok', response: { items: venues } });
    } catch (err) {
        console.error('Error executing query', err);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
});

app.listen(port, () => {
    console.log(`Server is listening at http://localhost:${port}`);
});
