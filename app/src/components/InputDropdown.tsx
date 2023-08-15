import {
  Input,
  InputGroup,
  InputRightElement,
  Icon,
  Popover,
  PopoverTrigger,
  PopoverContent,
  VStack,
  HStack,
  Button,
  Text,
  useDisclosure,
} from "@chakra-ui/react";

import { FiChevronDown } from "react-icons/fi";
import { BiCheck } from "react-icons/bi";

type InputDropdownProps<T> = {
  options: ReadonlyArray<T>;
  selectedOption: T;
  onSelect: (option: T) => void;
};

const InputDropdown = <T,>({ options, selectedOption, onSelect }: InputDropdownProps<T>) => {
  const popover = useDisclosure();

  return (
    <Popover placement="bottom-start" {...popover}>
      <PopoverTrigger>
        <InputGroup cursor="pointer" w={(selectedOption as string).length * 14 + 180}>
          <Input
            value={selectedOption as string}
            // eslint-disable-next-line @typescript-eslint/no-empty-function -- controlled input requires onChange
            onChange={() => {}}
            cursor="pointer"
            borderColor={popover.isOpen ? "blue.500" : undefined}
            _hover={popover.isOpen ? { borderColor: "blue.500" } : undefined}
            contentEditable={false}
            // disable focus
            onFocus={(e) => {
              e.target.blur();
            }}
          />
          <InputRightElement>
            <Icon as={FiChevronDown} />
          </InputRightElement>
        </InputGroup>
      </PopoverTrigger>
      <PopoverContent boxShadow="0 0 40px 4px rgba(0, 0, 0, 0.1);" minW={0} w="auto">
        <VStack spacing={0}>
          {options?.map((option, index) => (
            <HStack
              key={index}
              as={Button}
              onClick={() => {
                onSelect(option);
                popover.onClose();
              }}
              w="full"
              variant="ghost"
              justifyContent="space-between"
              fontWeight="semibold"
              borderRadius={0}
              colorScheme="blue"
              color="black"
              fontSize="sm"
              borderBottomWidth={1}
            >
              <Text mr={16}>{option as string}</Text>
              {option === selectedOption && <Icon as={BiCheck} color="blue.500" boxSize={5} />}
            </HStack>
          ))}
        </VStack>
      </PopoverContent>
    </Popover>
  );
};

export default InputDropdown;
