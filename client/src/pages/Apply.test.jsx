import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Apply from './Apply';
import { getJob, applyJob } from '../services/api';

jest.mock('react-router-dom', () => ({ useParams: () => ({ jobId: 'fixture-job' }) }));
jest.mock('../services/api', () => ({ getJob: jest.fn(), applyJob: jest.fn() }));
jest.mock('../components/Navbar', () => () => <nav>TalentMatch</nav>);

beforeEach(() => {
  jest.resetAllMocks();
  getJob.mockResolvedValue({ data: {
    title: 'Initial Job Title', description: 'Build services', company: { name: 'Initial Company' }
  } });
});

async function submit() {
  const { container } = render(<Apply />);
  await screen.findByRole('heading', { name: 'Apply for Initial Job Title' });
  const [name, email] = screen.getAllByRole('textbox');
  fireEvent.change(name, { target: { value: 'Fixture Candidate' } });
  fireEvent.change(email, { target: { value: 'fixture@example.test' } });
  const cv = new File(['synthetic CV'], 'fixture.pdf', { type: 'application/pdf' });
  fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [cv] } });
  fireEvent.submit(container.querySelector('form'));
  return cv;
}

test.each([
  ['Senior Engineer', 'Example Company'],
  ['Designer', 'Another Company']
])('confirmation uses submitted job %s and company %s without evaluation details', async (jobTitle, companyName) => {
  applyJob.mockResolvedValue({ data: { message: 'Application submitted successfully', jobTitle, companyName } });
  const cv = await submit();
  expect(await screen.findByRole('heading', { name: 'Application submitted successfully.' })).toBeInTheDocument();
  expect(screen.getByText(`Your application has been received for ${jobTitle} at ${companyName}. The hiring team will contact you if you are selected for the next stage.`)).toBeInTheDocument();
  expect(screen.queryByText(/score|shortlisted|rejected|status:|\/ 1000/i)).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to Jobs' })).toHaveAttribute('href', '/');
  expect(applyJob).toHaveBeenCalledTimes(1);
  const data = applyJob.mock.calls[0][0];
  expect(data.get('jobId')).toBe('fixture-job');
  expect(data.get('name')).toBe('Fixture Candidate');
  expect(data.get('email')).toBe('fixture@example.test');
  expect(data.get('cv')).toBe(cv);
});

test('success never displays evaluation details even if an older response includes them', async () => {
  applyJob.mockResolvedValue({ data: {
    jobTitle: 'Engineer', companyName: 'Example Company',
    candidate: { name: 'Fixture Candidate', scores: { total: 900 }, status: 'shortlisted' }
  } });
  await submit();
  await screen.findByRole('heading', { name: 'Application submitted successfully.' });
  expect(screen.queryByText(/score|shortlisted|rejected|900|status:/i)).not.toBeInTheDocument();
});

test('submission failure keeps the form available and does not show confirmation', async () => {
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    applyJob.mockRejectedValue(new Error('Synthetic submission failure'));
    await submit();
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit Application' })).toBeEnabled());
    expect(screen.queryByRole('heading', { name: 'Application submitted successfully.' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/');
  } finally {
    errorLog.mockRestore();
  }
});
