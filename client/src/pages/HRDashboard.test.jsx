import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import HRDashboard from './HRDashboard';
import { getMyJobs, getCandidates, getCandidateCV, deleteCandidate } from '../services/api';

jest.mock('../services/api', () => ({
  getMyJobs: jest.fn(), getCandidates: jest.fn(), getCandidateCV: jest.fn(), deleteCandidate: jest.fn()
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

test('deletion names the applicant, refreshes list/count and preserves the remaining row', async () => {
  const other = { ...candidate, _id: 'other', name: 'Other Fixture' };
  getCandidates.mockResolvedValueOnce({ data: [candidate, other] }).mockResolvedValue({ data: [other] });
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  deleteCandidate.mockResolvedValue({ data: { message: 'Application and uploaded CV permanently deleted.' } });
  render(<HRDashboard />);
  await screen.findByText(candidate.name);
  fireEvent.click(within(screen.getByText(candidate.name).closest('tr')).getByRole('button', { name: 'Delete Application' }));
  await screen.findByText('1 applicant');
  expect(window.confirm).toHaveBeenCalledWith(`${candidate.name}\n\nDelete this application and its uploaded CV permanently? This cannot be undone.`);
  expect(deleteCandidate).toHaveBeenCalledWith(candidate._id);
  expect(getCandidates).toHaveBeenCalledTimes(2);
  expect(screen.queryByText(candidate.name)).not.toBeInTheDocument();
  expect(screen.getByText('Other Fixture')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('permanently deleted');
  expect(screen.queryByText('Education')).not.toBeInTheDocument();
});

test('cancelling deletion sends no delete or refresh request', async () => {
  jest.spyOn(window, 'confirm').mockReturnValue(false);
  render(<HRDashboard />);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete Application' }));
  expect(deleteCandidate).not.toHaveBeenCalled();
  expect(getCandidates).toHaveBeenCalledTimes(1);
  expect(screen.getByText(candidate.name)).toBeInTheDocument();
});

test('deletion blocks repeated clicks, CV opening and job switching while pending', async () => {
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  let complete;
  deleteCandidate.mockReturnValue(new Promise(resolve => { complete = resolve; }));
  render(<HRDashboard />);
  const button = await screen.findByRole('button', { name: 'Delete Application' });
  fireEvent.click(button);
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(deleteCandidate).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'View CV' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Fixture Job - Fixture Company' })).toBeDisabled();
  getCandidates.mockResolvedValue({ data: [] });
  await act(async () => complete({ data: { message: 'Application deleted.' } }));
  expect(await screen.findByText('0 applicants')).toBeInTheDocument();
});

for (const [label, error, message] of [
  ['partial cleanup', { response: { data: { message: 'CV cleanup completed, but application deletion could not be confirmed.' } } }, 'CV cleanup completed'],
  ['network error', new Error('Synthetic network failure'), 'Application deletion could not be confirmed']
]) test(`${label} is reported honestly and refreshes the current records`, async () => {
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  deleteCandidate.mockRejectedValue(error);
  render(<HRDashboard />);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete Application' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(message);
  await waitFor(() => expect(getCandidates).toHaveBeenCalledTimes(2));
  expect(screen.getByText(candidate.name)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Delete Application' })).toBeEnabled());
});

test('successful deletion with refresh failure reports both outcomes', async () => {
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  deleteCandidate.mockResolvedValue({ data: { message: 'Application and uploaded CV permanently deleted.' } });
  getCandidates.mockResolvedValueOnce({ data: [candidate] }).mockRejectedValue(new Error('Synthetic refresh failure'));
  render(<HRDashboard />);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete Application' }));
  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('permanently deleted');
  expect(alert).toHaveTextContent('Unable to refresh');
  expect(screen.getByText('0 applicants')).toBeInTheDocument();
});

test('late candidate response from a previous job cannot overwrite the selected job', async () => {
  getMyJobs.mockResolvedValue({ data: [
    { _id: 'synthetic-job', title: 'Fixture Job', company: { name: 'Fixture Company' } },
    { _id: 'second-job', title: 'Second Job', company: { name: 'Fixture Company' } }
  ] });
  let complete;
  getCandidates.mockReturnValueOnce(new Promise(resolve => { complete = resolve; }))
    .mockResolvedValue({ data: [{ ...candidate, _id: 'second', name: 'Second Fixture' }] });
  render(<HRDashboard />);
  fireEvent.click(await screen.findByRole('button', { name: 'Fixture Job - Fixture Company' }));
  fireEvent.click(screen.getByRole('button', { name: 'Second Job - Fixture Company' }));
  await screen.findByText('Second Fixture');
  await act(async () => complete({ data: [candidate] }));
  expect(screen.queryByText(candidate.name)).not.toBeInTheDocument();
  expect(screen.getByText('Second Fixture')).toBeInTheDocument();
});
