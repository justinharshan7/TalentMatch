import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Home from './Home';
import { getJobs } from '../services/api';

jest.mock('../services/api', () => ({ getJobs: jest.fn() }));
jest.mock('../components/Navbar', () => () => <nav>TalentMatch</nav>);

const jobs = [
  { _id: 'one', title: 'Zebra Developer', description: 'Build services', createdAt: '2026-10-01T00:00:00Z', company: { name: 'Alpha Co' }, requirements: { skills: ['Java'] } },
  { _id: 'two', title: 'Alpha Developer', description: 'Build applications', createdAt: '2026-10-03T00:00:00Z', company: { name: 'Beta Co' }, requirements: { skills: ['React'] } },
  { _id: 'three', title: 'Middle Developer', description: 'Build systems', createdAt: '2026-10-02T00:00:00Z', company: { name: 'Alpha Co' }, requirements: { skills: ['Java'] } },
];

beforeEach(() => {
  jest.resetAllMocks();
  getJobs.mockResolvedValue({ data: jobs });
});

async function setup() {
  render(<Home />);
  await screen.findByRole('heading', { name: 'Featured Positions (3)' });
  return screen.getByRole('combobox', { name: 'Sort by Newest first' });
}

function titles() {
  return screen.queryAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
}

test('labelled trigger opens and closes the dashboard-style list with selected option', async () => {
  const button = await setup();
  expect(button).toHaveAttribute('aria-haspopup', 'listbox');
  expect(button).toHaveAttribute('aria-expanded', 'false');
  userEvent.click(button);
  const list = screen.getByRole('listbox', { name: 'Sort by' });
  expect(button).toHaveAttribute('aria-controls', list.id);
  expect(button).toHaveAttribute('aria-expanded', 'true');
  const selected = within(list).getByRole('option', { name: 'Newest first', selected: true });
  expect(button).toHaveFocus();
  expect(button).toHaveAttribute('aria-activedescendant', selected.id);
  expect(selected).toHaveClass('bg-[#F7F8FA]', 'font-medium', 'text-[#2952E3]');
  expect(within(list).getAllByRole('option')).toHaveLength(3);
  userEvent.click(button);
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(button).toHaveFocus();
});

test('all three selections preserve sorting and never mutate the fetched jobs array', async () => {
  const before = jobs.map((job) => job._id);
  const button = await setup();
  expect(titles()).toEqual(['Alpha Developer', 'Middle Developer', 'Zebra Developer']);
  for (const [label, expected] of [
    ['Oldest first', ['Zebra Developer', 'Middle Developer', 'Alpha Developer']],
    ['Title A–Z', ['Alpha Developer', 'Middle Developer', 'Zebra Developer']],
    ['Newest first', ['Alpha Developer', 'Middle Developer', 'Zebra Developer']]
  ]) {
    userEvent.click(button);
    userEvent.click(screen.getByRole('option', { name: label }));
    expect(button).toHaveTextContent(label);
    expect(titles()).toEqual(expected);
    expect(button).toHaveFocus();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  }
  expect(jobs.map((job) => job._id)).toEqual(before);
});

test('outside pointer/touch dismissal closes without changing the selection', async () => {
  const button = await setup();
  userEvent.click(button);
  fireEvent.pointerDown(screen.getByRole('heading', { name: 'Find Your Next Opportunity' }), { pointerType: 'touch' });
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(button).toHaveTextContent('Newest first');
});

test('Escape cancels keyboard navigation and restores trigger focus', async () => {
  const button = await setup();
  button.focus();
  userEvent.keyboard('{ArrowDown}{ArrowDown}');
  expect(button).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Oldest first' }).id);
  expect(titles()).toEqual(['Alpha Developer', 'Middle Developer', 'Zebra Developer']);
  userEvent.keyboard('{Escape}');
  expect(button).toHaveFocus();
  expect(button).toHaveAttribute('aria-expanded', 'false');
  expect(button).toHaveTextContent('Newest first');
});

test('arrow navigation wraps and Enter commits the focused option', async () => {
  const button = await setup();
  button.focus();
  userEvent.keyboard('{Enter}{ArrowUp}');
  expect(button).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Title A–Z' }).id);
  userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
  expect(button).toHaveTextContent('Oldest first');
  expect(button).toHaveFocus();
  expect(titles()[0]).toBe('Zebra Developer');
});

test('Space opens and selects; Home and End reach the first and last options', async () => {
  const button = await setup();
  button.focus();
  userEvent.keyboard(' ');
  userEvent.keyboard('{End}');
  expect(button).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Title A–Z' }).id);
  userEvent.keyboard('{Home}');
  expect(button).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Newest first' }).id);
  userEvent.keyboard('{ArrowDown} ');
  expect(button).toHaveTextContent('Oldest first');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});

test('Tab leaves the dropdown without trapping focus or committing a tentative option', async () => {
  const button = await setup();
  userEvent.click(button);
  userEvent.keyboard('{ArrowDown}');
  userEvent.tab();
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(button).toHaveTextContent('Newest first');
  expect(screen.getByRole('link', { name: 'Alpha Developer' })).toHaveFocus();
  userEvent.click(button);
  userEvent.tab({ shift: true });
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(button).not.toHaveFocus();
});

test('reopening focuses the current selection and moving focus outside dismisses the list', async () => {
  const button = await setup();
  userEvent.click(button);
  userEvent.click(screen.getByRole('option', { name: 'Oldest first' }));
  userEvent.click(button);
  expect(button).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Oldest first', selected: true }).id);
  act(() => screen.getByPlaceholderText('Search by title, company or skill...').focus());
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});

test('search, company filtering, count, and job links remain intact after sorting', async () => {
  const button = await setup();
  userEvent.click(screen.getByRole('button', { name: 'Alpha Co' }));
  expect(screen.getByRole('heading', { name: 'Featured Positions (2)' })).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText('Search by title, company or skill...'), { target: { value: 'Java' } });
  userEvent.click(button);
  userEvent.click(screen.getByRole('option', { name: 'Oldest first' }));
  expect(titles()).toEqual(['Zebra Developer', 'Middle Developer']);
  expect(screen.getByRole('heading', { name: 'Featured Positions (2)' })).toBeInTheDocument();
  const card = screen.getByRole('heading', { name: 'Zebra Developer' }).parentElement;
  expect(within(card).getByRole('link', { name: 'Zebra Developer' })).toHaveAttribute('href', '/jobs/one');
  expect(within(card).getByRole('link', { name: 'View Details' })).toHaveAttribute('href', '/jobs/one');
  expect(within(card).getByRole('link', { name: 'Apply Now' })).toHaveAttribute('href', '/apply/one');
  fireEvent.change(screen.getByPlaceholderText('Search by title, company or skill...'), { target: { value: 'no-match' } });
  expect(screen.getByRole('heading', { name: 'Featured Positions (0)' })).toBeInTheDocument();
  expect(screen.getByText('No jobs match your search.')).toBeInTheDocument();
});
