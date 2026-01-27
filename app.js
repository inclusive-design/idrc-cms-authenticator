import {env} from 'node:process';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import express from 'express';
import middleware from './middleware/index.js';

dotenv.config({silent: true});

const port = env.PORT || 3000;

const app = express();
app.use(cookieParser());

app.get('/', (_request, response) => {
	response.status(404).send();
});

app.get('/auth', middleware.auth);
app.get('/callback', middleware.callback);

app.listen(port);
