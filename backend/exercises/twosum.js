module.exports = {
  id: "sum-two-numbers",
  title: "Suma dwóch liczb",
  difficulty: "easy",
  description: "Napisz funkcję wypisującą sumę dwóch liczb.",
  longdescription: 
  `Napisz funkcję main() która wypisuje sumę dwóch liczb całkowitych jako string.
Input: string w postaci "<liczba1> <liczba2>" np. "2 8"
Output: string w postaci "<suma>", np "10"
Input jest podany poprzez pierwszy stdin (pierwsze wypisanie z buforu wejsciowego).
Output jest podany poprzez ostatni stdout`,

  generateInputOutput: () => {
    const a = Math.floor(Math.random() * 100);
    const b = Math.floor(Math.random() * 100);

    return {
        args: `${a} ${b}`,
        expected: `${a + b}`
    };
  },
};