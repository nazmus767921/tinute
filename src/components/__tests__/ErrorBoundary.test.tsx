import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';
import { ErrorBoundary } from '../ErrorBoundary';

const BombComponent: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Test crash in child component');
  }
  return <div>Safe child content</div>;
};

const TestApp: React.FC<{ onReset: () => void }> = ({ onReset }) => {
  const [hasError, setHasError] = useState(true);

  return (
    <ErrorBoundary
      fallbackTitle="Custom Error Title"
      onReset={() => {
        setHasError(false);
        onReset();
      }}
    >
      <BombComponent shouldThrow={hasError} />
    </ErrorBoundary>
  );
};

describe('ErrorBoundary Component', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary fallbackTitle="Custom Error Title">
        <BombComponent shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Safe child content')).toBeInTheDocument();
  });

  it('catches error, displays alert banner and fallback title without crashing app', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary fallbackTitle="Custom Error Title">
        <BombComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Custom Error Title')).toBeInTheDocument();
    expect(screen.getByText('Test crash in child component')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('triggers onReset callback and recovers to render children when Try Again is clicked', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onResetSpy = vi.fn();

    render(<TestApp onReset={onResetSpy} />);

    expect(screen.getByText('Custom Error Title')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(retryBtn);

    expect(onResetSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Safe child content')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
