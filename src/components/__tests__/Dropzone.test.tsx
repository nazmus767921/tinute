import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Dropzone } from '../Dropzone';
import { usePipelineStore } from '../../store/pipelineStore';

describe('Dropzone Component', () => {
  it('renders standard full dropzone with keyboard accessibility', () => {
    render(<Dropzone />);

    const region = screen.getByRole('region', { name: /image dropzone/i });
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute('tabindex', '0');

    const button = screen.getByRole('button', { name: /browse files/i });
    expect(button).toBeInTheDocument();
  });

  it('triggers file input on Enter or Space key press', () => {
    render(<Dropzone />);
    const region = screen.getByRole('region', { name: /image dropzone/i });
    const input = screen.getByLabelText(/file upload input/i);

    const clickSpy = vi.spyOn(input, 'click');
    fireEvent.keyDown(region, { key: 'Enter' });
    expect(clickSpy).toHaveBeenCalled();
  });

  it('handles drag over and drag leave states', () => {
    render(<Dropzone />);
    const region = screen.getByRole('region', { name: /image dropzone/i });

    fireEvent.dragOver(region);
    expect(region.className).toContain('border-accent');

    fireEvent.dragLeave(region);
    expect(region.className).not.toContain('scale-[1.005]');
  });

  it('renders compact dropzone when compact prop is true', () => {
    render(<Dropzone compact={true} />);

    const compactRegion = screen.getByRole('region', { name: /add more images/i });
    expect(compactRegion).toBeInTheDocument();
    expect(screen.getByText(/drop more images here/i)).toBeInTheDocument();
  });

  it('adds files to pipeline store on file drop', () => {
    const addFilesSpy = vi.fn();
    usePipelineStore.setState({ addFiles: addFilesSpy });

    render(<Dropzone />);
    const region = screen.getByRole('region', { name: /image dropzone/i });

    const file = new File(['fake-image-bytes'], 'test.jpg', { type: 'image/jpeg' });
    fireEvent.drop(region, {
      dataTransfer: {
        files: [file],
      },
    });

    expect(addFilesSpy).toHaveBeenCalledWith([file]);
  });
});
