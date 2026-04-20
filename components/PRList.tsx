import type { PersonPRs } from "@/lib/queries";
import PersonCard from "./PersonCard";

interface Props {
  persons: PersonPRs[];
}

export default function PRList({ persons }: Props) {
  return (
    <div>
      {/* Jump buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        {persons.map((person) => (
          <a
            key={person.personId}
            href={`#${person.personId}`}
            className="px-3 py-1 rounded-full text-sm bg-white border border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
          >
            {person.personName}
          </a>
        ))}
      </div>

      <div className="space-y-4">
        {persons.map((person) => (
          <PersonCard key={person.personId} person={person} />
        ))}
      </div>
    </div>
  );
}
