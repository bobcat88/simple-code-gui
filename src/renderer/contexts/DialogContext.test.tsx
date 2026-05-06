import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DialogProvider, useDialog } from './DialogContext';

function TestShowError() {
  const { showError } = useDialog();
  return <button onClick={() => showError('Something went wrong')}>trigger error</button>;
}

function TestShowInfo() {
  const { showInfo } = useDialog();
  return <button onClick={() => showInfo('FYI message')}>trigger info</button>;
}

function TestShowConfirm({ onResult }: { onResult: (v: boolean) => void }) {
  const { showConfirm } = useDialog();
  return (
    <button
      onClick={async () => {
        const result = await showConfirm('Are you sure?');
        onResult(result);
      }}
    >
      trigger confirm
    </button>
  );
}

function TestThrow() {
  const { showError } = useDialog();
  return <button onClick={() => showError('x')}>x</button>;
}

describe('DialogProvider', () => {
  it('renders children without dialog by default', () => {
    render(
      <DialogProvider>
        <span>hello</span>
      </DialogProvider>
    );
    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('showError opens error dialog with Dismiss button', async () => {
    render(
      <DialogProvider>
        <TestShowError />
      </DialogProvider>
    );
    fireEvent.click(screen.getByText('trigger error'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Dismiss')).toBeInTheDocument();
    expect(screen.queryByText('Cancel')).toBeNull();
  });

  it('Dismiss closes the error dialog', async () => {
    render(
      <DialogProvider>
        <TestShowError />
      </DialogProvider>
    );
    fireEvent.click(screen.getByText('trigger error'));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByText('Dismiss'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('showInfo opens info dialog with OK button', async () => {
    render(
      <DialogProvider>
        <TestShowInfo />
      </DialogProvider>
    );
    fireEvent.click(screen.getByText('trigger info'));
    expect(await screen.findByText('Info')).toBeInTheDocument();
    expect(screen.getByText('FYI message')).toBeInTheDocument();
    expect(screen.getByText('OK')).toBeInTheDocument();
    expect(screen.queryByText('Cancel')).toBeNull();
  });

  it('showConfirm opens confirm dialog with Cancel and Confirm buttons', async () => {
    const onResult = vi.fn();
    render(
      <DialogProvider>
        <TestShowConfirm onResult={onResult} />
      </DialogProvider>
    );
    fireEvent.click(screen.getByText('trigger confirm'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  });

  it('Confirm button resolves showConfirm with true', async () => {
    const onResult = vi.fn();
    render(
      <DialogProvider>
        <TestShowConfirm onResult={onResult} />
      </DialogProvider>
    );
    fireEvent.click(screen.getByText('trigger confirm'));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
  });

  it('Cancel button resolves showConfirm with false', async () => {
    const onResult = vi.fn();
    render(
      <DialogProvider>
        <TestShowConfirm onResult={onResult} />
      </DialogProvider>
    );
    fireEvent.click(screen.getByText('trigger confirm'));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });

  it('clicking backdrop closes dialog', async () => {
    render(
      <DialogProvider>
        <TestShowError />
      </DialogProvider>
    );
    fireEvent.click(screen.getByText('trigger error'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(dialog.parentElement!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('Escape key closes dialog', async () => {
    render(
      <DialogProvider>
        <TestShowError />
      </DialogProvider>
    );
    fireEvent.click(screen.getByText('trigger error'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('useDialog', () => {
  it('throws when used outside DialogProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestThrow />)).toThrow('useDialog must be used inside DialogProvider');
    consoleError.mockRestore();
  });
});
