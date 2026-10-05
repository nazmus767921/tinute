import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Dropzone } from '../Dropzone';
import { usePipelineStore } from '../../store/pipelineStore';

describe('image selection', () => {
  it('submits selected files and supports selecting the same image again', () => {
    const addFiles = vi.fn();
    usePipelineStore.setState({ addFiles });
    render(<Dropzone />);
    const image = new File(['x'], 'photo.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Choose images'), { target: { files: [image] } });
    expect(addFiles).toHaveBeenCalledWith([image]);
    expect(screen.getByRole('button', { name: 'Choose images' }).tagName).toBe('BUTTON');
  });
  it('supports drag and drop without making the entire region an interactive control', () => {
    const addFiles = vi.fn();
    usePipelineStore.setState({ addFiles });
    render(<Dropzone />);
    const image = new File(['x'], 'photo.png');
    const region = screen.getByRole('region', { name: 'Add images' });
    fireEvent.drop(region, { dataTransfer: { files: [image] } });
    expect(addFiles).toHaveBeenCalledWith([image]);
    expect(region).not.toHaveAttribute('tabindex');
  });
  it('offers a compact add-more action', () => {
    render(<Dropzone compact />);
    expect(screen.getByRole('button', { name: 'Add more images' })).toBeInTheDocument();
  });
});
