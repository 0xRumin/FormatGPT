# FormatGPT

FormatGPT is a small utility script that helps standardize and format text or code snippets using configurable formatting rules and templates. It is intended to make it easier to apply consistent formatting conventions across files, code blocks, and generated text.

## Features

- Apply predefined or custom formatting templates to text and code
- Support for multiple languages and snippet types via templates
- CLI-first design for integration into scripts and CI
- Minimal dependencies and easy configuration

## Requirements

- Python 3.8+ (or Node.js if this repository uses JS — adjust as needed)
- Any additional dependencies listed in requirements.txt or package.json

## Installation

1. Clone the repository:

   git clone https://github.com/0xRumin/FormatGPT.git

2. Install dependencies (example for Python):

   python -m pip install -r requirements.txt

## Usage

Basic CLI usage (example):

  formatgpt --input example.txt --template default --output formatted.txt

Replace the command above with the actual script name and flags present in this repository.

## Configuration

Configure formatting templates in the `templates/` directory (or the config file used by the script). Templates can define rules for indentation, line-wrapping, code fences, and other formatting specifics.

## Contributing

Contributions, bug reports, and feature requests are welcome. Please open an issue or submit a pull request with tests and documentation changes.

## License

Specify the repository license here (e.g., MIT).
