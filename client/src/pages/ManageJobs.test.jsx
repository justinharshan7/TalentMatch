import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ManageJobs from './ManageJobs';
import { getMyJobs, getJobDeletionInfo, deleteJob } from '../services/api';

jest.mock('../services/api', () => ({
  getMyJobs: jest.fn(),
  getJobDeletionInfo: jest.fn(),
  deleteJob: jest.fn(),
}));
jest.mock('../components/Navbar', () => () => <nav>TalentMatch</nav>);

const job = { _id: 'job-1', title: 'Developer', company: { name: 'Company' }, isDeleting: false };

beforeEach(() => {
  jest.resetAllMocks();
  getMyJobs.mockResolvedValue({ data: [job] });
  getJobDeletionInfo.mockResolvedValue({ data: { applicationCount: 2 } });
  deleteJob.mockResolvedValue({ data: { message: 'Permanently deleted.' } });
  jest.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => jest.restoreAllMocks());

test('checks actual count before confirmation; cancel never calls delete', async () => {
  window.confirm.mockReturnValue(false);
  render(<ManageJobs />);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(window.confirm).toHaveBeenCalledWith(
    'Permanently delete "Developer"?\n\nApplications: 2\n\nThis will permanently remove the job, all associated applications, and their uploaded CVs. This cannot be undone. If deletion fails, some items may already have been permanently removed.\n\nContinue?'
  ));
  expect(getJobDeletionInfo).toHaveBeenCalledWith('job-1');
  expect(deleteJob).not.toHaveBeenCalled();
  expect(screen.getByText('Developer')).toBeInTheDocument();
  expect(getMyJobs).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
});

test('confirmed deletion sends the counted value, removes row, and shows success', async () => {
  render(<ManageJobs />);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
  expect(await screen.findByRole('status')).toHaveTextContent('"Developer" deleted.');
  expect(deleteJob).toHaveBeenCalledWith('job-1', 2);
  expect(screen.queryByText('Developer')).not.toBeInTheDocument();
});

test('zero applications uses a normal permanent-deletion warning', async () => {
  getJobDeletionInfo.mockResolvedValue({ data: { applicationCount: 0 } });
  render(<ManageJobs />);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
  await screen.findByRole('status');
  const warning = window.confirm.mock.calls[0][0];
  expect(warning).toContain('Permanently delete "Developer"?');
  expect(warning).toContain('Applications: 0');
  expect(warning).toContain('This cannot be undone.');
  expect(deleteJob).toHaveBeenCalledWith('job-1', 0);
});

test('disables repeated clicks during count check and deletion', async () => {
  let finishCount;
  let finishDeletion;
  getJobDeletionInfo.mockReturnValue(new Promise((resolve) => { finishCount = resolve; }));
  deleteJob.mockReturnValue(new Promise((resolve) => { finishDeletion = resolve; }));
  render(<ManageJobs />);
  const button = await screen.findByRole('button', { name: 'Delete' });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(button).toBeDisabled();
  expect(getJobDeletionInfo).toHaveBeenCalledTimes(1);
  await act(async () => { finishCount({ data: { applicationCount: 2 } }); });
  expect(button).toBeDisabled();
  expect(deleteJob).toHaveBeenCalledTimes(1);
  await act(async () => { finishDeletion({ data: { message: 'Permanently deleted.' } }); });
  expect(screen.getByRole('status')).toHaveTextContent('"Developer" deleted.');
});

test('failed count check never confirms or deletes and reports an error', async () => {
  getJobDeletionInfo.mockRejectedValue({ response: { data: { message: 'Unable to check applications.' } } });
  render(<ManageJobs />);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to check applications.');
  expect(screen.getByRole('alert')).toHaveTextContent('Could not check applications for "Developer"');
  expect(window.confirm).not.toHaveBeenCalled();
  expect(deleteJob).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled());
});

test('partial failure refreshes persisted status and exposes Retry Deletion without Edit', async () => {
  deleteJob.mockRejectedValue({ response: { data: { message: 'Deletion incomplete. Use Retry Deletion.' } } });
  getMyJobs.mockResolvedValueOnce({ data: [job] }).mockResolvedValue({ data: [{ ...job, isDeleting: true }] });
  render(<ManageJobs />);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Deletion incomplete.');
  const retry = await screen.findByRole('button', { name: 'Retry Deletion' });
  await waitFor(() => expect(retry).toBeEnabled());
  expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
  expect(screen.getByText(/Closed to applications and editing/)).toBeInTheDocument();
  deleteJob.mockResolvedValue({ data: { message: 'Retry finished.' } });
  fireEvent.click(retry);
  expect(await screen.findByRole('status')).toHaveTextContent('"Developer" deleted.');
});

test('HTML count endpoint 404 identifies the actual failure without claiming partial deletion', async () => {
  getJobDeletionInfo.mockRejectedValue({ response: { status: 404, data: '<pre>Cannot GET /api/jobs/job-1/deletion-info</pre>' } });
  render(<ManageJobs />);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
  const error = await screen.findByRole('alert');
  expect(error).toHaveTextContent('Could not check applications for "Developer"');
  expect(error).toHaveTextContent('HTTP 404');
  expect(error).not.toHaveTextContent(/partially|incomplete|could not be confirmed/i);
  expect(window.confirm).not.toHaveBeenCalled();
  expect(deleteJob).not.toHaveBeenCalled();
  expect(getMyJobs).toHaveBeenCalledTimes(1);
});

test('count network error sends no deletion request and does not imply cleanup', async () => {
  getJobDeletionInfo.mockRejectedValue(new Error('Network Error'));
  render(<ManageJobs />);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server. No deletion request was sent.');
  expect(deleteJob).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Retry Deletion' })).not.toBeInTheDocument();
});

test('invalid count response never opens confirmation or sends deletion', async () => {
  getJobDeletionInfo.mockResolvedValue({ data: '<html>Unexpected response</html>' });
  render(<ManageJobs />);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('invalid application count');
  expect(window.confirm).not.toHaveBeenCalled();
  expect(deleteJob).not.toHaveBeenCalled();
});

test('changed-count deletion error identifies the job without claiming incomplete cleanup', async () => {
  deleteJob.mockRejectedValue({ response: { status: 409, data: { message: 'The application count changed. Check and confirm deletion again.' } } });
  render(<ManageJobs />);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete "Developer": The application count changed.');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled());
  expect(screen.queryByRole('button', { name: 'Retry Deletion' })).not.toBeInTheDocument();
});

test('deletion network failure reports unknown response without assuming partial cleanup', async () => {
  deleteJob.mockRejectedValue(new Error('Network Error'));
  render(<ManageJobs />);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
  const error = await screen.findByRole('alert');
  expect(error).toHaveTextContent('Could not delete "Developer": No response was received');
  expect(error).not.toHaveTextContent(/partially|incomplete/i);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled());
});

test('incomplete response preserves per-job retry guidance if refreshing fails', async () => {
  deleteJob.mockRejectedValue({ response: { data: { message: 'CV file permission denied.', deletionIncomplete: true } } });
  getMyJobs.mockResolvedValueOnce({ data: [job] }).mockRejectedValue(new Error('Network Error'));
  render(<ManageJobs />);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
  const retry = await screen.findByRole('button', { name: 'Retry Deletion' });
  await waitFor(() => expect(retry).toBeEnabled());
  expect(screen.getByRole('alert')).toHaveTextContent('Could not delete "Developer": CV file permission denied.');
  expect(screen.getByRole('alert')).toHaveTextContent('Unable to refresh');
  expect(screen.getByText(/Use Retry Deletion to finish cleanup/)).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
});

test('permanent cleanup warning appears in confirmation, not permanently above the job list', async () => {
  render(<ManageJobs />);
  await screen.findByRole('button', { name: 'Delete' });
  expect(screen.queryByText(/If cleanup fails|some files or applications may already be removed/i)).not.toBeInTheDocument();
});

test('lost deletion response remains visible even if refresh no longer lists that job', async () => {
  deleteJob.mockRejectedValue(new Error('Network Error'));
  getMyJobs.mockResolvedValueOnce({ data: [job] }).mockResolvedValue({ data: [] });
  render(<ManageJobs />);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(screen.queryByText('Developer')).not.toBeInTheDocument());
  expect(screen.getByRole('alert')).toHaveTextContent('Could not delete "Developer": No response was received');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
