using System;

class Program
{
    static void Main()
    {
        string password = "@L3ph2026";
        string hash = BCrypt.Net.BCrypt.HashPassword(password);
        
        Console.WriteLine("Password: " + password);
        Console.WriteLine("BCrypt Hash: " + hash);
        Console.WriteLine("\nSQL Update Statement:");
        Console.WriteLine($"UPDATE AdminUsuarios SET PasswordHash = '{hash}' WHERE Username = 'develop';");
    }
}
