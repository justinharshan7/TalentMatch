import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import HRRegister from './HRRegister';
import { registerHR } from '../services/api';

jest.mock('../services/api', () => ({ registerHR: jest.fn() }));

beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); });

function fill(overrides = {}) {
  const fields = { 'Full Name': '  Test HR  ', Email: 'HR@EXAMPLE.TEST', Password: 'synthetic-password', 'Confirm Password': 'synthetic-password', 'Company Name': '  Synthetic Company  ', 'Company Description': '  Example description.  ', ...overrides };
  for (const [label, value] of Object.entries(fields)) fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
function submit(container) { fireEvent.submit(container.querySelector('form')); }

test('registration submits a new company and HR account, then offers sign in', async () => {
  registerHR.mockResolvedValue({ data: { token: 'unused-test-token', user: { name: 'Test HR' } } });
  const { container } = render(<HRRegister />);
  fill(); submit(container);
  expect(registerHR).toHaveBeenCalledWith({ name: 'Test HR', email: 'hr@example.test', password: 'synthetic-password', companyName: 'Synthetic Company', companyDescription: 'Example description.' });
  expect(await screen.findByRole('heading', { name: 'Your account is ready' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/hr-login');
  expect(container.querySelector('form')).toBeNull();
  expect(localStorage.length).toBe(0);
});

test('mismatched passwords are rejected before any API request', () => {
  const { container } = render(<HRRegister />);
  fill({ 'Confirm Password': 'different-password' }); submit(container);
  expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match.');
  expect(registerHR).not.toHaveBeenCalled();
});

test.each(['1234567', 'é'.repeat(37)])('invalid password length is rejected before submission', (password) => {
  const { container } = render(<HRRegister />);
  fill({ Password: password, 'Confirm Password': password }); submit(container);
  expect(screen.getByRole('alert')).toHaveTextContent(password.length < 8 ? 'at least 8 characters' : 'Password is too long');
  expect(registerHR).not.toHaveBeenCalled();
});

test('blank company information is rejected after trimming', () => {
  const { container } = render(<HRRegister />);
  fill({ 'Company Name': '   ' }); submit(container);
  expect(screen.getByRole('alert')).toHaveTextContent('Enter your name, company name and company description.');
  expect(registerHR).not.toHaveBeenCalled();
});

test('API validation errors are shown and the form remains available for correction', async () => {
  registerHR.mockRejectedValue({ response: { data: { message: 'Company already exists.' } } });
  const { container } = render(<HRRegister />);
  fill(); submit(container);
  expect(await screen.findByRole('alert')).toHaveTextContent('Company already exists.');
  expect(screen.getByRole('button', { name: 'Create Account' })).toBeEnabled();
  expect(screen.getByLabelText('Company Name')).toHaveValue('  Synthetic Company  ');
});

test('network failures offer a retry without storing a session', async () => {
  registerHR.mockRejectedValue(new Error('Synthetic offline failure'));
  const { container } = render(<HRRegister />);
  fill(); submit(container);
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to create your account. Please try again.');
  expect(localStorage.length).toBe(0);
});

test('repeated submit events cannot create duplicate requests while registration is pending', async () => {
  let resolve;
  registerHR.mockImplementation(() => new Promise((done) => { resolve = done; }));
  const { container } = render(<HRRegister />);
  fill(); submit(container); submit(container);
  expect(registerHR).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Creating account...' })).toBeDisabled();
  expect(screen.getByLabelText('Email')).toBeDisabled();
  resolve({ data: {} });
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Your account is ready' })).toBeInTheDocument());
});

test('registration labels, limits and navigation are accessible', () => {
  render(<HRRegister />);
  expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
  expect(screen.getByLabelText('Password')).toHaveAttribute('minlength', '8');
  expect(screen.getByLabelText('Company Description')).toHaveAttribute('maxlength', '2000');
  expect(screen.getByRole('link', { name: 'Continue as Guest' })).toHaveAttribute('href', '/');
  expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/hr-login');
});
