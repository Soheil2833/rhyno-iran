"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover"

export interface AccountOption {
  code: string
  title: string
  fullLabel: string
  type?: "SL" | "DL" // Added type for distinguishing
}

interface AccountSelectorProps {
  accounts: AccountOption[]
  value: string
  onChange: (val: string) => void
  disabled?: boolean
}

export function AccountSelector({
  accounts,
  value,
  onChange,
  disabled
}: AccountSelectorProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")

  // Find selected account
  const selectedAccount = accounts.find(account => account.code === value)

  // Custom filter logic for Persian support
  const filteredAccounts = accounts.filter(
    account =>
      account.fullLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
      account.code.includes(searchQuery) ||
      account.title.includes(searchQuery)
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-9 w-full justify-between border-gray-300 bg-white text-xs !text-black shadow-sm transition-all hover:border-blue-400 hover:bg-gray-50"
        >
          {selectedAccount ? (
            <span
              className="w-full truncate text-right font-bold text-gray-900"
              dir="rtl"
            >
              {selectedAccount.fullLabel}
            </span>
          ) : (
            <span className="w-full text-right text-gray-500">
              جستجو و انتخاب حساب...
            </span>
          )}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 text-gray-600 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="z-[9999] w-[350px] border border-gray-200 bg-white p-0 shadow-2xl"
        align="end" // Align right for RTL
        side="bottom"
      >
        <Command className="bg-white" shouldFilter={false}>
          <div className="flex items-center border-b px-3 py-1" dir="rtl">
            <Search className="ml-2 size-4 shrink-0 text-gray-500 opacity-50" />
            <CommandInput
              placeholder="جستجو (کد یا نام)..."
              value={searchQuery}
              onValueChange={setSearchQuery}
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-right font-sans text-sm !text-black outline-none placeholder:text-gray-400"
            />
          </div>

          <CommandList
            className="max-h-[300px] overflow-y-auto bg-white p-1"
            dir="rtl"
          >
            {filteredAccounts.length === 0 && (
              <div className="py-6 text-center text-sm text-gray-500">
                حسابی یافت نشد.
              </div>
            )}

            <CommandGroup>
              {filteredAccounts.map(account => (
                <CommandItem
                  key={`${account.type}-${account.code}`} // Unique key
                  value={account.fullLabel}
                  onSelect={() => {
                    onChange(account.code)
                    setOpen(false)
                  }}
                  className="relative flex cursor-pointer select-none items-center rounded-sm p-2 text-sm text-gray-700 outline-none transition-colors hover:bg-gray-100 data-[disabled]:pointer-events-none data-[selected=true]:bg-blue-50"
                >
                  <Check
                    className={cn(
                      "ml-2 size-4 text-green-600",
                      value === account.code ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex w-full flex-col items-start gap-0.5 overflow-hidden text-right">
                    <span className="w-full truncate text-xs font-semibold text-gray-900">
                      {account.fullLabel} {/* Shows Icon + Code + Title */}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
