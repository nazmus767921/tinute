import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ByteBot } from '../ByteBot';

describe('ByteBot mascot', () => {
  it('renders with role="img" and descriptive accessible label', () => {
    render(<ByteBot mood="idle" />);
    const bot = screen.getByRole('img', { name: /bytebot 3000 \(idle state\)/i });
    expect(bot).toBeInTheDocument();
  });

  it('renders with rich expression and gesture animation classes in idle state by default', () => {
    const { container } = render(<ByteBot mood="idle" />);
    expect(container.querySelector('.bytebot-idle-nod')).toBeInTheDocument();
    expect(container.querySelector('.bytebot-idle-eyes-look')).toBeInTheDocument();
    expect(container.querySelector('.bytebot-idle-blink')).toBeInTheDocument();
    expect(container.querySelector('.bytebot-anim-eyebrows')).toBeInTheDocument();
    expect(container.querySelector('.bytebot-anim-eye-wink')).toBeInTheDocument();
    expect(container.querySelector('.bytebot-anim-eyes-happy')).toBeInTheDocument();
    expect(container.querySelector('.bytebot-anim-mouth-o')).toBeInTheDocument();
    expect(container.querySelector('.bytebot-anim-mouth-open')).toBeInTheDocument();
  });

  it('suppresses animation classes when animated={false}', () => {
    const { container } = render(<ByteBot mood="idle" animated={false} />);
    expect(container.querySelector('.bytebot-idle-nod')).not.toBeInTheDocument();
    expect(container.querySelector('.bytebot-idle-eyes-look')).not.toBeInTheDocument();
    expect(container.querySelector('.bytebot-idle-blink')).not.toBeInTheDocument();
    expect(container.querySelector('.bytebot-anim-eyebrows')).not.toBeInTheDocument();
    expect(container.querySelector('.bytebot-anim-eye-wink')).not.toBeInTheDocument();
  });

  it('renders different moods accurately', () => {
    const { rerender } = render(<ByteBot mood="hungry" />);
    expect(screen.getByRole('img', { name: /hungry state/i })).toBeInTheDocument();

    rerender(<ByteBot mood="crunching" />);
    expect(screen.getByRole('img', { name: /crunching state/i })).toBeInTheDocument();

    rerender(<ByteBot mood="celebrating" />);
    expect(screen.getByRole('img', { name: /celebrating state/i })).toBeInTheDocument();

    rerender(<ByteBot mood="wink" />);
    expect(screen.getByRole('img', { name: /wink state/i })).toBeInTheDocument();

    rerender(<ByteBot mood="error" />);
    expect(screen.getByRole('img', { name: /error state/i })).toBeInTheDocument();
  });

  it('supports sizing variants (sm, md, lg)', () => {
    const { rerender, container } = render(<ByteBot size="sm" />);
    let wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveStyle({ width: '36px', height: '36px' });

    rerender(<ByteBot size="md" />);
    wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveStyle({ width: '72px', height: '72px' });

    rerender(<ByteBot size="lg" />);
    wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveStyle({ width: '120px', height: '120px' });
  });

  it('maintains invariant canonical brand colors across light and dark themes', () => {
    const { container } = render(<ByteBot mood="idle" />);
    const headCasing = container.querySelector('rect[fill="#ffffff"]');
    expect(headCasing).toBeInTheDocument();
    const crtScreen = container.querySelector('rect[fill="#12141c"]');
    expect(crtScreen).toBeInTheDocument();
    const eyes = container.querySelectorAll('circle[fill="#00e5ff"]');
    expect(eyes.length).toBeGreaterThanOrEqual(2);
  });
});
