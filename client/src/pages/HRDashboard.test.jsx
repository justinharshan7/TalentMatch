import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import HRDashboard from './HRDashboard';
import { getMyJobs, getCandidates, getCandidateCV } from '../services/api';

jest.mock('../services/api', () => ({
  getMyJobs: jest.fn(), getCandidates: jest.fn(), getCandidateCV: jest.fn()
}));
jest.mock('../components/Navbar', () => () => <nav>TalentMatch</nav>);

const candidate = {
  _id: 'synthetic-candidate', name: 'Fixture Candidate', email: 'fixture@example.test',
  cvPath: 'uploads/must-not-be-requested.pdf', status: 'shortlisted',
  scores: { total: 700, skills: 300, education: 100, experience: 100, certifications: 100, softSkills: 100 }
};
let preview;
let downloaded;

beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers();
  localStorage.setItem('token', 'synthetic-test-token');
  getMyJobs.mockResolvedValue({ data: [{ _id: 'synthetic-job', title: 'Fixture Job', company: { name: 'Fixture Company' } }] });
  getCandidates.mockResolvedValue({ data: [candidate] });
  getCandidateCV.mockResolvedValue({ data: new Blob(['synthetic PDF fixture']), headers: { 'content-type': 'application/pdf' } });
  preview = { opener: {}, location: { href: 'about:blank' }, closed: false, close: jest.fn() };
  jest.spyOn(window, 'open').mockReturnValue(preview);
  URL.createObjectURL = jest.fn(() => 'blob:synthetic-fixture');
  URL.revokeObjectURL = jest.fn();
  downloaded = null;
  jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
    downloaded = { href: this.href, filename: this.download };
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

async function openCV() {
  render(<HRDashboard />);
  const button = await screen.findByRole('button', { name: 'View CV' });
  fireEvent.click(button);
  return button;
}

test('HR retains descending ranking, statuses and expandable category scores', async () => {
  const lower = {
    ...candidate, _id: 'lower-candidate', name: 'Lower Fixture', status: 'rejected',
    scores: { total: 400, skills: 200, education: 50, experience: 50, certifications: 50, softSkills: 50 }
  };
  getCandidates.mockResolvedValue({ data: [lower, candidate] });
  render(<HRDashboard />);
  await screen.findByText(candidate.name);
  const rows = within(screen.getByRole('table')).getAllByRole('row');
  expect(within(rows[1]).getByText(candidate.name)).toBeInTheDocument();
  expect(within(rows[1]).getByText('700')).toBeInTheDocument();
  expect(within(rows[1]).getByText('shortlisted')).toBeInTheDocument();
  expect(within(rows[2]).getByText('Lower Fixture')).toBeInTheDocument();
  expect(within(rows[2]).getByText('400')).toBeInTheDocument();
  expect(within(rows[2]).getByText('rejected')).toBeInTheDocument();
  fireEvent.click(screen.getByText(candidate.name));
  for (const label of ['Skills', 'Education', 'Experience', 'Certifications', 'Soft Skills']) {
    expect(screen.getByText(label)).toBeInTheDocument();
  }
  expect(screen.getByText('300 / 400')).toBeInTheDocument();
  expect(screen.getAllByText('100 / 200')).toHaveLength(2);
  expect(screen.getAllByText('100 / 100')).toHaveLength(2);
  expect(getCandidates).toHaveBeenCalledWith('synthetic-job');
});

test('View CV requests only the candidate ID and opens the PDF Blob in a new tab', async () => {
  const button = await openCV();
  await waitFor(() => expect(button).toBeEnabled());
  expect(getCandidateCV).toHaveBeenCalledWith('synthetic-candidate');
  expect(window.open).toHaveBeenCalledWith('about:blank', '_blank');
  expect(preview.opener).toBeNull();
  expect(preview.location.href).toBe('blob:synthetic-fixture');
  expect(preview.close).not.toHaveBeenCalled();
  expect(screen.queryByRole('link', { name: 'View CV' })).not.toBeInTheDocument();
  expect(screen.queryByText('Education')).not.toBeInTheDocument();
  const blob = URL.createObjectURL.mock.calls[0][0];
  expect(blob.type).toBe('application/pdf');
});

test('DOCX is downloaded with an appropriate filename and closes the blank tab', async () => {
  getCandidateCV.mockResolvedValue({ data: new Blob(['synthetic DOCX fixture']), headers: {
    'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  } });
  const button = await openCV();
  await waitFor(() => expect(button).toBeEnabled());
  expect(preview.close).toHaveBeenCalledTimes(1);
  expect(downloaded).toEqual({ href: 'blob:synthetic-fixture', filename: 'candidate-synthetic-candidate.docx' });
});

test('blocked PDF popup falls back to a download', async () => {
  window.open.mockReturnValue(null);
  const button = await openCV();
  await waitFor(() => expect(button).toBeEnabled());
  expect(downloaded).toEqual({ href: 'blob:synthetic-fixture', filename: 'candidate-synthetic-candidate.pdf' });
});

test('repeated View CV clicks make only one protected request while it is loading', async () => {
  let complete;
  getCandidateCV.mockReturnValue(new Promise((resolve) => { complete = resolve; }));
  const button = await openCV();
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(getCandidateCV).toHaveBeenCalledTimes(1);
  await act(async () => complete({ data: new Blob(['fixture']), headers: { 'content-type': 'application/pdf' } }));
  expect(button).toBeEnabled();
});

for (const [status, message] of [
  [401, 'Your session has expired. Please sign in again.'],
  [403, 'You do not have permission to view this CV.'],
  [404, 'The candidate or CV file was not found.']
]) {
  test(`HTTP ${status} closes the blank tab and shows a useful error`, async () => {
    getCandidateCV.mockRejectedValue({ response: { status } });
    const button = await openCV();
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(preview.close).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(button).toBeEnabled();
  });
}

test('JSON errors delivered as Axios Blobs are decoded for display', async () => {
  const errorBlob = new Blob(['fixture']);
  errorBlob.text = async () => JSON.stringify({ message: 'Unable to read CV file safely' });
  getCandidateCV.mockRejectedValue({ response: { status: 500, data: errorBlob } });
  await openCV();
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to read CV file safely');
});

test('network failure provides a fallback and never opens a public file URL', async () => {
  getCandidateCV.mockRejectedValue(new Error('Synthetic network failure'));
  await openCV();
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to open this CV. Please try again.');
  expect(preview.close).toHaveBeenCalledTimes(1);
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});

test('unexpected MIME type is not opened as an executable document', async () => {
  getCandidateCV.mockResolvedValue({ data: new Blob(['fixture']), headers: { 'content-type': 'text/html' } });
  await openCV();
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to open this CV. Please try again.');
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  expect(preview.close).toHaveBeenCalledTimes(1);
});

test('temporary Blob URLs are revoked after a minute', async () => {
  const button = await openCV();
  await waitFor(() => expect(button).toBeEnabled());
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(60000));
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:synthetic-fixture');
});

test('unmounting releases temporary URLs immediately', async () => {
  const button = await openCV();
  await waitFor(() => expect(button).toBeEnabled());
  cleanup();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:synthetic-fixture');
});
