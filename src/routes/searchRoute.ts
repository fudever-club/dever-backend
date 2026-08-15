import express from 'express';
import { globalSearch } from '../controllers/searchController';

const Router = express.Router();

Router.get('/', globalSearch);

module.exports = Router;
