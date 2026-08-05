const mongoose = require('mongoose');

const entrySchema = new mongoose.Schema(
  {
    id: String,
    date: String, // ISO yyyy-mm-dd
    bill: String,
    debit: Number,
    credit: Number,
    paidDate: String
  },
  { _id: false }
);

const companySchema = new mongoose.Schema(
  {
    id: String,
    name: String,
    gstin: String,
    entries: [entrySchema]
  },
  { _id: false }
);

const ledgerSchema = new mongoose.Schema(
  {
    // Single-document store: this app manages one ledger ("main") that
    // contains every customer company and its bills. If you ever need
    // multiple separate ledgers/users, add a real "key" per user/business.
    key: { type: String, default: 'main', unique: true },
    ownCompany: { type: String, default: 'Sri Kathir Ganapathy Spares' },
    companies: [companySchema]
  },
  { timestamps: true }
);

const Ledger = mongoose.model('Ledger', ledgerSchema);

// Starter data used only the very first time the app runs
// (i.e. when the "main" ledger document doesn't exist yet in MongoDB).
const SEED = {
  key: 'main',
  ownCompany: 'Sri Kathir Ganapathy Spares',
  companies: [
    {
      id: 'c-abhilash',
      name: 'Abhilash Chemicals & Pharmaceuticals, Madurai',
      gstin: '33AABCA7508H1ZZ',
      entries: [
        { id: 'e-1', date: '2026-04-03', bill: '524', debit: 10839, credit: 10839, paidDate: '2026-04-10' },
        { id: 'e-2', date: '2026-04-10', bill: '538', debit: 7550, credit: 7550, paidDate: '2026-04-10' },
        { id: 'e-3', date: '2026-05-01', bill: '576', debit: 10389, credit: 10389, paidDate: '2026-05-09' },
        { id: 'e-4', date: '2026-05-11', bill: '580', debit: 10390, credit: 10390, paidDate: '2026-05-18' },
        { id: 'e-5', date: '2026-05-26', bill: '595', debit: 11800, credit: 11800, paidDate: '2026-06-01' },
        { id: 'e-6', date: '2026-05-27', bill: '597', debit: 11800, credit: 11800, paidDate: '2026-06-01' },
        { id: 'e-7', date: '2026-06-10', bill: '604', debit: 11800, credit: 11800, paidDate: '2026-06-12' },
        { id: 'e-8', date: '2026-06-11', bill: '607', debit: 11800, credit: null, paidDate: null },
        { id: 'e-9', date: '2026-06-23', bill: '613', debit: 6391, credit: 6391, paidDate: '2026-06-25' },
        { id: 'e-10', date: '2026-07-02', bill: '614', debit: 11800, credit: 11800, paidDate: '2026-07-10' },
        { id: 'e-11', date: '2026-07-07', bill: '621', debit: 11800, credit: 11800, paidDate: '2026-07-10' },
        { id: 'e-12', date: '2026-07-13', bill: '625', debit: 11800, credit: 11800, paidDate: '2026-07-14' },
        { id: 'e-13', date: '2026-07-14', bill: '627', debit: 9464, credit: 9464, paidDate: '2026-07-18' },
        { id: 'e-14', date: '2026-07-25', bill: '628', debit: 11800, credit: 11800, paidDate: '2026-07-28' }
      ]
    }
  ]
};

module.exports = { Ledger, SEED };
