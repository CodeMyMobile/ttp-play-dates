import { X, Phone, Mail } from "lucide-react";

export default function ContactsPreview({ contacts = [], errors = {}, onEdit, onRemove }) {
  if (!contacts.length) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
        No contacts yet. Add some from the tabs above.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
        <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500">
          <tr>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Phone</th>
            <th className="px-4 py-2">Email</th>
            <th className="px-4 py-2">Channel</th>
            <th className="px-4 py-2 text-right">Remove</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {contacts.map((contact) => {
            const contactError = errors[contact.id] || {};
            return (
              <tr key={contact.id} className="align-top">
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={contact.name || ""}
                    onChange={(event) => onEdit?.(contact.id, { name: event.target.value })}
                    placeholder="Optional"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      contactError.phone
                        ? "border-red-300 bg-red-50 text-red-700"
                        : "border-gray-200 text-gray-800"
                    }`}>
                      <Phone className="h-4 w-4 text-gray-400" />
                      <input
                        type="tel"
                        value={contact.phone || ""}
                        onChange={(event) => onEdit?.(contact.id, { phone: event.target.value })}
                        className="w-full bg-transparent text-sm outline-none"
                        placeholder="E.164"
                      />
                    </div>
                    {contactError.phone && (
                      <p className="text-xs font-semibold text-red-600">{contactError.phone}</p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      contactError.email
                        ? "border-red-300 bg-red-50 text-red-700"
                        : "border-gray-200 text-gray-800"
                    }`}>
                      <Mail className="h-4 w-4 text-gray-400" />
                      <input
                        type="email"
                        value={contact.email || ""}
                        onChange={(event) => onEdit?.(contact.id, { email: event.target.value })}
                        className="w-full bg-transparent text-sm outline-none"
                        placeholder="name@example.com"
                      />
                    </div>
                    {contactError.email && (
                      <p className="text-xs font-semibold text-red-600">{contactError.email}</p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={contact.channel || (contact.phone ? "sms" : "email")}
                    onChange={(event) => onEdit?.(contact.id, { channel: event.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  >
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onRemove?.(contact.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
                  >
                    <X className="h-4 w-4" />
                    Remove
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
