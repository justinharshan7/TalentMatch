import { useState } from 'react';

export default function TagInput({ label, tags, setTags }) {
  const [input, setInput] = useState('');

  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
    }
    setInput('');
  };

  const removeTag = (tag) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <div>
      <label className="text-sm font-medium text-[#14181F] block mb-1">{label}</label>
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Add ${label.toLowerCase()} and press Enter`}
          className="flex-1 border border-[#E5E8EE] rounded-lg px-4 py-2 text-sm outline-none focus:border-[#2952E3]"
        />
        <button
          type="button"
          onClick={addTag}
          className="bg-[#E5E8EE] text-[#5B6472] text-sm font-medium px-4 rounded-lg hover:bg-[#D8DCE3]"
        >
          Add
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 text-xs bg-[#F7F8FA] border border-[#E5E8EE] px-2 py-1 rounded-full text-[#5B6472]"
          >
            {tag}
            <button type="button" onClick={() => removeTag(tag)} className="text-[#5B6472] hover:text-red-600">
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}