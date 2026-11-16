import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HRLogin from './HRLogin';
import { loginHR } from '../services/api';

jest.mock('../services/api', () => ({ loginHR: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

afterEach(() => localStorage.clear());

test('guest link follows the login form, targets public Home and is keyboard accessible', () => {
  const { container } = render(<HRLogin />);
  expect(screen.getByText('Looking for a job?')).toBeInTheDocument();
  const link = screen.getByRole('link', { name: 'Continue as Guest' });
  expect(link).toHaveAttribute('href', '/');
  const explanation = screen.getByText('Browse vacancies and submit your CV.');
  expect(explanation).toHaveClass('text-xs');
  expect(link.nextElementSibling).toBe(explanation);
  expect(screen.getAllByRole('link')).toHaveLength(1);
  expect(container.querySelector('form').contains(link)).toBe(false);
  userEvent.tab();
  userEvent.tab();
  userEvent.tab();
  expect(screen.getByRole('button', { name: 'Login' })).toHaveFocus();
  userEvent.tab();
  expect(link).toHaveFocus();
  expect(link).toHaveClass('focus-visible:outline-2');
  expect(loginHR).not.toHaveBeenCalled();
  expect(localStorage.length).toBe(0);
});

test('HR login still submits credentials and displays an authentication error', async () => {
  loginHR.mockRejectedValue({ response: { data: { message: 'Invalid credentials' } } });
  const { container } = render(<HRLogin />);
  fireEvent.change(container.querySelector('input[type="email"]'), { target: { value: 'hr@example.test' } });
  fireEvent.change(container.querySelector('input[type="password"]'), { target: { value: 'synthetic-password' } });
  fireEvent.submit(container.querySelector('form'));
  expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
  expect(loginHR).toHaveBeenCalledWith({ email: 'hr@example.test', password: 'synthetic-password' });
  expect(screen.getByRole('button', { name: 'Login' })).toBeEnabled();
  expect(localStorage.length).toBe(0);
});
