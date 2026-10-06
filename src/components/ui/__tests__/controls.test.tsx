import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Select, Checkbox, RadioGroup, Slider } from '../controls';
function Example() {
  const [value, setValue] = useState('a');
  const [checked, setChecked] = useState(false);
  const [number, setNumber] = useState(50);
  const options = [
    { value: 'a', label: 'Apple' },
    { value: 'b', label: 'Banana' },
  ];
  return (
    <>
      <Select label="Fruit" value={value} onValueChange={setValue} options={options} />
      <RadioGroup label="Choice" value={value} onValueChange={setValue} options={options} />
      <Checkbox label="Privacy" checked={checked} onCheckedChange={setChecked} />
      <Slider label="Amount" value={number} onValueChange={setNumber} />
    </>
  );
}
describe('shared custom controls', () => {
  it('keeps keyboard selection when scrolling emits a stationary pointer event', () => {
    render(<Example />);
    const select = screen.getByRole('combobox');
    fireEvent.keyDown(select, { key: 'End' });
    fireEvent.pointerMove(screen.getByRole('option', { name: 'Apple' }), {
      movementX: 0,
      movementY: 0,
    });
    fireEvent.keyDown(select, { key: 'Enter' });
    expect(select).toHaveTextContent('Banana');
  });
  it('selects with arrows, commits with Enter and dismisses with Escape', () => {
    render(<Example />);
    const select = screen.getByRole('combobox');
    fireEvent.keyDown(select, { key: 'ArrowDown' });
    fireEvent.keyDown(select, { key: 'ArrowDown' });
    fireEvent.keyDown(select, { key: 'Enter' });
    expect(select).toHaveTextContent('Banana');
    expect(select).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(select);
    fireEvent.keyDown(select, { key: 'Home' });
    fireEvent.keyDown(select, { key: 'Tab' });
    expect(select).toHaveTextContent('Apple');
    fireEvent.click(select);
    fireEvent.keyDown(select, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
  it('supports radio arrows, checkbox activation and slider limits', () => {
    render(<Example />);
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Apple' }), { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: 'Banana' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider).toHaveAttribute('aria-valuenow', '51');
    fireEvent.keyDown(slider, { key: 'End' });
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider).toHaveAttribute('aria-valuenow', '100');
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(slider).toHaveAttribute('aria-valuenow', '0');
  });
});
