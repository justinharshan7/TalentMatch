import { render, screen } from '@testing-library/react';
import App from './App';
import { getJobs } from './services/api';

jest.mock('./services/api', () => ({ getJobs: jest.fn() }));

beforeEach(() => {
  localStorage.clear();
  getJobs.mockResolvedValue({ data: [] });
});

afterEach(() => { window.history.replaceState({}, '', '/'); });

test('public home route shows TalentMatch jobs', async () => {
  window.history.replaceState({}, '', '/');
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Find Your Next Opportunity' })).toBeInTheDocument();
  expect(await screen.findByText('No jobs match your search.')).toBeInTheDocument();
});

test('HR login route includes the registration link', () => {
  window.history.replaceState({}, '', '/hr-login');
  render(<App />);
  expect(screen.getByRole('heading', { name: 'HR Login' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Create an HR account' })).toHaveAttribute('href', '/hr-register');
});

test('HR registration route shows the new company and account form', () => {
  window.history.replaceState({}, '', '/hr-register');
  render(<App />);
  expect(screen.getByRole('heading', { name: 'HR Registration' })).toBeInTheDocument();
  expect(screen.getByLabelText('Company Name')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/hr-login');
});
